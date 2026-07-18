import { deterministicInternalId, parseVlrSourceReference } from "../identity/deterministicId";
import type { MatchDiscoveryManifest, MatchManifestEntry } from "../discovery/matchManifest";
import type { IngestionStore } from "../persistence/types";
import type { ReconciliationEntry, ReconciliationReport } from "./reconciliationTypes";
import type { ReconciliationCategory } from "./reconciliationTypes";

/**
 * Match reconciliation — TASK-043 requirement 10. Same shape as
 * `eventReconciliation.ts`, one level down: compares the current match
 * discovery manifest against every normalized match record actually
 * persisted, additionally checking each match's *parent event* category so
 * a match under a since-excluded event is correctly reported "out-of-scope"
 * rather than "current-approved" even though the match record itself
 * hasn't changed.
 */
export async function reconcileMatches(
  store: IngestionStore,
  matchManifest: MatchDiscoveryManifest,
  eventCategoryByVlrEventId: ReadonlyMap<string, ReconciliationCategory>,
  now: () => Date = () => new Date(),
): Promise<ReconciliationReport> {
  const generatedAt = now().toISOString();
  const manifestByVlrId = new Map<string, MatchManifestEntry>(matchManifest.entries.map((entry) => [entry.vlrMatchId, entry]));
  const persistedInternalIds = await store.listNormalizedEntityIds("match");

  const entries: ReconciliationEntry[] = [];
  const persistedByExternalId = new Map<string, string>();

  for (const internalId of persistedInternalIds) {
    const parsed = parseVlrSourceReference(internalId);
    if (!parsed || parsed.entityType !== "match") {
      entries.push({ internalId, providerExternalId: internalId, category: "orphaned", reason: "Persisted match record has a malformed internal ID that does not parse as a VLR match source reference." });
      continue;
    }
    persistedByExternalId.set(parsed.externalId, internalId);

    const manifestEntry = manifestByVlrId.get(parsed.externalId);
    if (!manifestEntry) {
      entries.push({ internalId, providerExternalId: parsed.externalId, category: "stale", reason: `No entry for VLR match ${parsed.externalId} exists in the current match discovery manifest — likely dropped because its parent event was pruned (see match discovery's "prune events no longer included").` });
      continue;
    }

    const eventCategory = eventCategoryByVlrEventId.get(manifestEntry.eventId);
    if (eventCategory === undefined) {
      entries.push({ internalId, providerExternalId: parsed.externalId, category: "orphaned", reason: `Parent event ${manifestEntry.eventId} has no corresponding event reconciliation entry at all — a dangling parent reference.` });
    } else if (eventCategory !== "current-approved") {
      entries.push({ internalId, providerExternalId: parsed.externalId, category: "out-of-scope", reason: `Parent event ${manifestEntry.eventId} is categorized "${eventCategory}", not current-approved.` });
    } else if (manifestEntry.listedStatus !== "completed") {
      entries.push({ internalId, providerExternalId: parsed.externalId, category: "out-of-scope", reason: `Manifest currently lists this match's status as "${manifestEntry.listedStatus}", not completed.` });
    } else {
      entries.push({ internalId, providerExternalId: parsed.externalId, category: "current-approved", reason: `Listed completed under current-approved event ${manifestEntry.eventId}.` });
    }
  }

  for (const manifestEntry of matchManifest.entries) {
    if (persistedByExternalId.has(manifestEntry.vlrMatchId)) continue;
    if (manifestEntry.listedStatus === "completed") continue; // included-but-not-yet-normalized is a backfill gap, not a reconciliation concern — see discovery/completenessValidation.ts.
    const internalId = deterministicInternalId("match", manifestEntry.vlrMatchId);
    entries.push({
      internalId,
      providerExternalId: manifestEntry.vlrMatchId,
      category: "audit-only-historical",
      reason: `Listed status "${manifestEntry.listedStatus}" (non-completed) and correctly never normalized — retained only in the discovery manifest as an audit record.`,
    });
  }

  entries.sort((a, b) => a.internalId.localeCompare(b.internalId));
  return { entries, generatedAt };
}
