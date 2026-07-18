import { APPROVED_EVENT_FAMILIES } from "../classification/eventFamily";
import { deterministicInternalId } from "../identity/deterministicId";
import type { NormalizedMatch } from "../normalize/normalizedSchemas";
import type { EventDiscoveryCheckpoint, IngestionStore } from "../persistence/types";
import type { EventDiscoveryManifest } from "./eventManifest";
import type { MatchDiscoveryManifest } from "./matchManifest";

/**
 * Deterministic completeness validation — TASK-042 requirement 6/15. Every
 * rule here is a hard failure per the task specification; anything softer
 * (incomplete roster, missing optional split, unknown patch) belongs in the
 * data-quality report instead, as a warning, never here. This function
 * refuses to certify the dataset "complete" on record-level accounting
 * alone — it also requires positive evidence that discovery itself reached
 * the scope's start date and that every event's match list was verified
 * against its own listed count (see `eventDiscoveryCheckpoint` and
 * `matchManifest.countMismatchEvents`, both required parameters — there is
 * no "skip this check" default).
 */
export interface CompletenessValidationResult {
  readonly valid: boolean;
  readonly failures: readonly string[];
  readonly warnings: readonly string[];
}

export async function validateCompleteness(
  store: IngestionStore,
  eventManifest: EventDiscoveryManifest,
  matchManifest: MatchDiscoveryManifest,
  eventDiscoveryCheckpoint: EventDiscoveryCheckpoint | null,
): Promise<CompletenessValidationResult> {
  const failures: string[] = [];
  const warnings: string[] = [];

  if (!eventDiscoveryCheckpoint?.archiveComplete) {
    failures.push(`Event discovery has not been confirmed complete back through the scope start date (${eventManifest.scopeStartDate}). Resume with: pnpm ingest:vlr:discover`);
  }

  for (const family of APPROVED_EVENT_FAMILIES) {
    const hasFamily = eventManifest.entries.some((e) => e.inclusionStatus === "included" && e.classification === family);
    if (!hasFamily) failures.push(`No included events found for approved family "${family}".`);
  }

  // Every included event's match-discovery checkpoint must exist and be
  // explicitly verified complete — re-derived directly from persisted
  // checkpoint state (not an ephemeral in-memory list from a specific
  // discovery run), so this holds regardless of how the manifest was
  // produced. Covers both "pagination incomplete" (verifiedComplete: false)
  // and "never discovered at all" (no checkpoint).
  const includedEventIds = eventManifest.entries.filter((e) => e.inclusionStatus === "included").map((e) => e.vlrEventId);
  for (const vlrEventId of includedEventIds) {
    const checkpoint = await store.readMatchDiscoveryCheckpoint(vlrEventId);
    if (!checkpoint) {
      failures.push(`Included event ${vlrEventId} has no match-discovery checkpoint at all.`);
      continue;
    }
    if (!checkpoint.verifiedComplete) {
      failures.push(
        `Event ${vlrEventId}'s match discovery is not verified complete: found ${checkpoint.discoveredMatchIds.length} match(es) against a listed total of ${checkpoint.expectedMatchCount ?? "unknown"} — incomplete pagination.`,
      );
    } else if (checkpoint.expectedMatchCount !== undefined && checkpoint.discoveredMatchIds.length < checkpoint.expectedMatchCount) {
      // Defensive, independent of the orchestrator's own bookkeeping: a
      // checkpoint must never claim verified-complete while actually short.
      failures.push(`Event ${vlrEventId}'s match-discovery checkpoint claims verifiedComplete while ${checkpoint.discoveredMatchIds.length} of ${checkpoint.expectedMatchCount} matches are accounted for.`);
    }
  }

  const seenInternalIds = new Set<string>();
  const completedManifestEntries = matchManifest.entries.filter((e) => e.listedStatus === "completed");
  const unresolvedFailures = await store.listFailures({ resolved: false });
  const failedMatchIds = new Set(unresolvedFailures.filter((f) => f.entityType === "match").map((f) => f.externalId));

  for (const entry of completedManifestEntries) {
    const internalId = deterministicInternalId("match", entry.vlrMatchId);
    const record = await store.getNormalizedEntity<NormalizedMatch>("match", internalId);

    if (!record) {
      if (!failedMatchIds.has(entry.vlrMatchId)) {
        failures.push(`Discovered completed match ${entry.vlrMatchId} has no persisted normalized record and no recorded failure.`);
      }
      continue;
    }

    if (seenInternalIds.has(internalId)) failures.push(`Duplicate normalized match ID: ${internalId}.`);
    seenInternalIds.add(internalId);

    if (!record.metadata.provider || !record.metadata.providerExternalId) failures.push(`Match ${entry.vlrMatchId} is missing provider source identity in its metadata.`);
    if (record.trainingEligibility.eligible && !record.winnerId) failures.push(`Training-eligible match ${entry.vlrMatchId} has no winner.`);
    if (record.trainingEligibility.eligible && record.maps.every((m) => m.teamAScore === null && m.teamBScore === null)) {
      failures.push(`Training-eligible match ${entry.vlrMatchId} has zero played maps.`);
    }
    if (record.trainingEligibility.eligible && record.scheduledAt.iso && record.scheduledAt.iso < `${eventManifest.scopeStartDate}T00:00:00.000Z`) {
      failures.push(`Training-eligible match ${entry.vlrMatchId} is scheduled before the approved scope start date.`);
    }
    if (record.trainingEligibility.eligible && record.scheduledAt.iso && record.scheduledAt.iso > `${eventManifest.scopeEndDate}T23:59:59.999Z`) {
      failures.push(`Training-eligible match ${entry.vlrMatchId} is scheduled after the approved scope end date.`);
    }
    if (record.trainingEligibility.eligible && record.status !== "completed") {
      failures.push(`Non-completed match ${entry.vlrMatchId} is marked training-eligible.`);
    }
    if (!record.rosterSnapshots || record.rosterSnapshots.some((r) => r.playerInternalIds.length < 5)) {
      warnings.push(`Match ${entry.vlrMatchId} has an incomplete roster snapshot.`);
    }
  }

  for (const entry of eventManifest.entries) {
    if (entry.inclusionStatus === "included") {
      const family: string = entry.classification;
      if (!(APPROVED_EVENT_FAMILIES as readonly string[]).includes(family)) {
        failures.push(`Included event ${entry.vlrEventId} has an out-of-scope classification "${family}".`);
      }
    }
  }

  return { valid: failures.length === 0, failures, warnings };
}
