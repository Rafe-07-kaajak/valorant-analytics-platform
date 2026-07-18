import { deterministicInternalId } from "../identity/deterministicId";
import { resolveTeamIdentity } from "../identity/teamMapping";
import type { VlrTeamMappingEntry } from "../identity/teamMapping";
import { normalizeMatch } from "../normalize/normalizeMatch";
import type { NormalizedEvent, NormalizedMatch } from "../normalize/normalizedSchemas";
import type { IngestionStore } from "../persistence/types";
import type { BackfillScope } from "../scope/backfillScope";
import type { VlrMatchDetail } from "../vlr/schemas/raw";
import type { MatchDiscoveryManifest, MatchManifestEntry } from "../discovery/matchManifest";
import type { VlrIngestionProvider } from "./vlrIngestionProvider";

/**
 * Bounded batch backfill — TASK-042 requirements 8/9/16. Consumes the
 * persisted match discovery manifest directly (rather than re-running
 * `IngestionService.run`, which re-discovers events on every call) so a
 * batch touches only the matches it actually needs to. A match already
 * normalized as "completed" is never re-fetched; a match with an
 * unresolved, non-retryable failure recorded in the ledger is skipped
 * until explicitly retried.
 */
const MAX_ATTEMPTS_BEFORE_PERMANENT = 3;
/**
 * Parser circuit breaker — TASK-042 requirement 20. A run of consecutive
 * critical parse failures (the page loaded but did not parse into a valid
 * match record) is the signature of a markup change, not isolated bad
 * matches — continuing would just write hundreds of failure-ledger entries
 * for a problem retrying won't fix. The counter resets on any successful
 * parse, so occasional unrelated malformed pages never trip it.
 */
const CONSECUTIVE_PARSE_FAILURE_CIRCUIT_BREAKER_THRESHOLD = 4;

export interface BackfillRunnerDeps {
  readonly provider: VlrIngestionProvider;
  readonly store: IngestionStore;
  readonly teamMapping: ReadonlyMap<string, VlrTeamMappingEntry>;
  readonly now?: () => Date;
}

export interface BackfillBatchResult {
  readonly candidatesConsidered: number;
  readonly processed: number;
  readonly inserted: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly failed: number;
  readonly remainingPendingCount: number;
  readonly circuitBreakerTripped: boolean;
}

export interface BackfillBatchOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (info: { readonly vlrMatchId: string; readonly processed: number; readonly batchSize: number }) => void;
}

async function isPermanentlyFailed(store: IngestionStore, vlrMatchId: string): Promise<boolean> {
  const failures = await store.listFailures({ resolved: false });
  const failure = failures.find((f) => f.entityType === "match" && f.externalId === vlrMatchId && f.operation === "fetch-match");
  if (!failure) return false;
  return !failure.retryable || failure.attemptCount >= MAX_ATTEMPTS_BEFORE_PERMANENT;
}

/**
 * Runs one bounded batch (`batchSize` matches at most) against the match
 * manifest's completed entries. Safe to call repeatedly — each call resumes
 * from wherever the last one left off, purely by virtue of checking the
 * store and failure ledger before every fetch. Never holds the full dataset
 * in memory beyond one manifest and one batch's worth of in-flight records.
 */
export async function runBackfillBatch(deps: BackfillRunnerDeps, matchManifest: MatchDiscoveryManifest, scope: BackfillScope, batchSize: number, options: BackfillBatchOptions = {}): Promise<BackfillBatchResult> {
  const now = deps.now ?? (() => new Date());
  const parsedAt = now().toISOString();

  const candidates = matchManifest.entries.filter((entry): entry is MatchManifestEntry => entry.listedStatus === "completed" || entry.detailFetchStatus === "pending");

  let processed = 0;
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;
  let remainingPendingCount = 0;
  let consecutiveParseFailures = 0;
  let circuitBreakerTripped = false;

  const eventCache = new Map<string, NormalizedEvent | null>();
  const getEvent = async (vlrEventId: string): Promise<NormalizedEvent | null> => {
    if (eventCache.has(vlrEventId)) return eventCache.get(vlrEventId)!;
    const event = await deps.store.getNormalizedEntity<NormalizedEvent>("event", deterministicInternalId("event", vlrEventId));
    eventCache.set(vlrEventId, event);
    return event;
  };

  for (const entry of candidates) {
    if (options.signal?.aborted) throw new Error("Backfill batch was cancelled.");
    if (circuitBreakerTripped) break;

    const internalId = deterministicInternalId("match", entry.vlrMatchId);
    const existing = await deps.store.getNormalizedEntity<NormalizedMatch>("match", internalId);
    if (existing?.status === "completed") continue; // already done — never restarted, never counted against the batch

    if (await isPermanentlyFailed(deps.store, entry.vlrMatchId)) continue;

    if (processed >= batchSize) {
      remainingPendingCount += 1;
      continue;
    }

    const event = await getEvent(entry.eventId);
    if (!event) {
      await deps.store.recordFailure(
        { entityType: "match", externalId: entry.vlrMatchId, sourceUrl: entry.matchUrl, operation: "fetch-match", errorCode: "missing_parent_event", retryable: false, safeMessage: `Parent event ${entry.eventId} has no persisted normalized record.` },
        parsedAt,
      );
      failed += 1;
      processed += 1;
      continue;
    }

    processed += 1;
    options.onProgress?.({ vlrMatchId: entry.vlrMatchId, processed, batchSize });

    let detail: VlrMatchDetail | null;
    try {
      detail = await deps.provider.getMatch(entry.vlrMatchId, entry.eventId, { signal: options.signal, statusHint: entry.listedStatus });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retryable = !(error instanceof Error && "code" in error && (error as { code?: string }).code === "invalid_provider_id");
      await deps.store.recordFailure({ entityType: "match", externalId: entry.vlrMatchId, sourceUrl: entry.matchUrl, operation: "fetch-match", errorCode: "fetch_failed", retryable, safeMessage: message }, parsedAt);
      failed += 1;
      continue;
    }

    if (!detail) {
      await deps.store.recordFailure(
        { entityType: "match", externalId: entry.vlrMatchId, sourceUrl: entry.matchUrl, operation: "fetch-match", errorCode: "parse_failure", retryable: false, safeMessage: "Match detail page did not parse to a valid record." },
        parsedAt,
      );
      failed += 1;
      consecutiveParseFailures += 1;
      if (consecutiveParseFailures >= CONSECUTIVE_PARSE_FAILURE_CIRCUIT_BREAKER_THRESHOLD) {
        circuitBreakerTripped = true;
        break;
      }
      continue;
    }
    consecutiveParseFailures = 0;

    const teamAIdentity = resolveTeamIdentity(detail.teamAVlrTeamId, deps.teamMapping);
    const teamBIdentity = resolveTeamIdentity(detail.teamBVlrTeamId, deps.teamMapping);

    let normalized: NormalizedMatch;
    try {
      normalized = normalizeMatch({
        raw: detail,
        teamAIdentity,
        teamBIdentity,
        event,
        scopeStartDate: scope.startDate,
        scopeEndDate: scope.endDate,
        isDuplicate: false,
        isShowmatch: false,
        parsedAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await deps.store.recordFailure({ entityType: "match", externalId: entry.vlrMatchId, sourceUrl: entry.matchUrl, operation: "normalize", errorCode: "normalization_failure", retryable: false, safeMessage: message }, parsedAt);
      failed += 1;
      continue;
    }

    try {
      const result = await deps.store.upsertNormalizedEntity("match", internalId, normalized);
      if (!existing) inserted += 1;
      else if (result.changed) updated += 1;
      else unchanged += 1;
      await deps.store.markFailureResolved("match", entry.vlrMatchId, "fetch-match");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await deps.store.recordFailure({ entityType: "match", externalId: entry.vlrMatchId, sourceUrl: entry.matchUrl, operation: "persist", errorCode: "persistence_failure", retryable: true, safeMessage: message }, parsedAt);
      failed += 1;
    }
  }

  return { candidatesConsidered: candidates.length, processed, inserted, updated, unchanged, failed, remainingPendingCount, circuitBreakerTripped };
}

/**
 * Retries only matches with an unresolved, retryable failure already in the
 * ledger — never a fresh/never-attempted match (that's `runBackfillBatch`'s
 * job) and never a non-retryable or attempt-exhausted one (see
 * `isPermanentlyFailed`), satisfying TASK-042 requirement 16's "retry only
 * unresolved retryable failures by default".
 */
export async function runRetryBatch(deps: BackfillRunnerDeps, matchManifest: MatchDiscoveryManifest, scope: BackfillScope, batchSize: number, options: BackfillBatchOptions = {}): Promise<BackfillBatchResult> {
  const failures = await deps.store.listFailures({ resolved: false, retryable: true });
  const retryableIds = new Set(failures.filter((f) => f.entityType === "match" && f.operation === "fetch-match" && f.attemptCount < MAX_ATTEMPTS_BEFORE_PERMANENT).map((f) => f.externalId));
  const retryManifest: MatchDiscoveryManifest = { ...matchManifest, entries: matchManifest.entries.filter((entry) => retryableIds.has(entry.vlrMatchId)) };
  return runBackfillBatch(deps, retryManifest, scope, batchSize, options);
}
