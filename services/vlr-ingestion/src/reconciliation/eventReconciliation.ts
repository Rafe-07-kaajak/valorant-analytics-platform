import { deterministicInternalId, parseVlrSourceReference } from "../identity/deterministicId";
import type { EventDiscoveryManifest, EventManifestEntry } from "../discovery/eventManifest";
import type { IngestionStore } from "../persistence/types";
import type { ReconciliationEntry, ReconciliationReport } from "./reconciliationTypes";

/**
 * Event reconciliation — TASK-043 requirement 10. Compares the *current*
 * event discovery manifest (the live source of truth for "what's
 * in-scope right now") against every normalized event record actually
 * persisted on disk. Read-only: never deletes or mutates either side.
 */
export async function reconcileEvents(store: IngestionStore, eventManifest: EventDiscoveryManifest, now: () => Date = () => new Date()): Promise<ReconciliationReport> {
  const generatedAt = now().toISOString();
  const manifestByVlrId = new Map<string, EventManifestEntry>(eventManifest.entries.map((entry) => [entry.vlrEventId, entry]));
  const persistedInternalIds = await store.listNormalizedEntityIds("event");

  const entries: ReconciliationEntry[] = [];
  const persistedByExternalId = new Map<string, string>();

  for (const internalId of persistedInternalIds) {
    const parsed = parseVlrSourceReference(internalId);
    if (!parsed || parsed.entityType !== "event") {
      entries.push({ internalId, providerExternalId: internalId, category: "orphaned", reason: `Persisted event record has a malformed internal ID that does not parse as a VLR event source reference.` });
      continue;
    }
    persistedByExternalId.set(parsed.externalId, internalId);

    const manifestEntry = manifestByVlrId.get(parsed.externalId);
    if (!manifestEntry) {
      entries.push({ internalId, providerExternalId: parsed.externalId, category: "stale", reason: `No entry for VLR event ${parsed.externalId} exists in the current event discovery manifest — likely dropped by a classification-rule change or a discovery restart.` });
    } else if (manifestEntry.inclusionStatus === "included") {
      entries.push({ internalId, providerExternalId: parsed.externalId, category: "current-approved", reason: `Included in the current manifest as "${manifestEntry.classification}".` });
    } else {
      entries.push({
        internalId,
        providerExternalId: parsed.externalId,
        category: "out-of-scope",
        reason: `A normalized record exists, but the current manifest classifies this event as "${manifestEntry.inclusionStatus}"${manifestEntry.exclusionReason ? ` (${manifestEntry.exclusionReason})` : ""} — likely superseded by a classification-rule change since this record was normalized.`,
      });
    }
  }

  for (const manifestEntry of eventManifest.entries) {
    if (persistedByExternalId.has(manifestEntry.vlrEventId)) continue; // already accounted for above.
    const internalId = deterministicInternalId("event", manifestEntry.vlrEventId);
    if (manifestEntry.inclusionStatus === "included") continue; // included-but-not-yet-normalized is a discovery/backfill gap, not a reconciliation concern — see discovery/completenessValidation.ts.
    entries.push({
      internalId,
      providerExternalId: manifestEntry.vlrEventId,
      category: "audit-only-historical",
      reason: `Correctly classified "${manifestEntry.inclusionStatus}" (${manifestEntry.exclusionReason ?? manifestEntry.classification}) and never normalized — retained only in the discovery manifest as an audit record.`,
    });
  }

  entries.sort((a, b) => a.internalId.localeCompare(b.internalId));
  return { entries, generatedAt };
}
