import { classifyEvent } from "../classification/eventClassification";
import { isApprovedEventFamily } from "../classification/eventFamily";
import type { EventClassificationOverride } from "../classification/eventOverrides";
import { IngestionError } from "../errors";
import { contentHash } from "../normalize/contentHash";
import { deterministicInternalId } from "../identity/deterministicId";
import { resolveTeamIdentity } from "../identity/teamMapping";
import type { VlrTeamMappingEntry } from "../identity/teamMapping";
import { normalizeEvent } from "../normalize/normalizeEvent";
import { normalizeMatch } from "../normalize/normalizeMatch";
import type { NormalizedEvent, NormalizedMatch } from "../normalize/normalizedSchemas";
import type { IngestionStore } from "../persistence/types";
import { serializeBackfillScope, validateBackfillScope } from "../scope/backfillScope";
import type { BackfillScope } from "../scope/backfillScope";
import type { VlrMatchDetail, VlrMatchSummary } from "../vlr/schemas/raw";
import { RunSummaryBuilder } from "./runSummary";
import type { RunSummary } from "./runSummary";
import type { VlrIngestionProvider } from "./vlrIngestionProvider";

/**
 * Ingestion coordinator — see docs/29-vlr-data-ingestion-foundation.md
 * ("Ingestion Orchestration") and TASK-041 requirement 22. Drives one bounded
 * run over a validated `BackfillScope`: discover → classify → dedupe →
 * fetch → normalize → evaluate eligibility → persist → checkpoint. Never
 * executes the full 2025-to-current backfill itself — that is TASK-042,
 * which calls this same coordinator with `buildCanonicalTargetScope()` and
 * lets `maximumEvents`/`maximumMatches` bound each run.
 */
export interface IngestionServiceDeps {
  readonly provider: VlrIngestionProvider;
  readonly store: IngestionStore;
  readonly teamMapping: ReadonlyMap<string, VlrTeamMappingEntry>;
  readonly eventOverrides: ReadonlyMap<string, EventClassificationOverride>;
  readonly now?: () => Date;
}

export interface RunOptions {
  readonly dryRun?: boolean;
  readonly signal?: AbortSignal;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class IngestionService {
  private readonly deps: IngestionServiceDeps;

  constructor(deps: IngestionServiceDeps) {
    this.deps = deps;
  }

  async run(scope: BackfillScope, options: RunOptions = {}): Promise<RunSummary> {
    const validation = validateBackfillScope(scope);
    if (!validation.valid) {
      throw new IngestionError("invalid_backfill_scope", `Backfill scope is invalid: ${validation.errors.join("; ")}`);
    }

    const dryRun = options.dryRun ?? false;
    const summary = new RunSummaryBuilder();
    const parsedAt = (this.deps.now?.() ?? new Date()).toISOString();
    let hadFailure = false;

    const assertNotCancelled = (): void => {
      if (options.signal?.aborted) throw new IngestionError("cancelled", "Ingestion run was cancelled.");
    };

    let discoveredEvents;
    try {
      discoveredEvents = await this.deps.provider.discoverEvents(scope, { signal: options.signal });
    } catch (error) {
      summary.recordFailure({ stage: "discover-events", externalId: "*", message: describeError(error) });
      return summary.build(scope, dryRun, "skipped-due-to-failure");
    }
    summary.discoveredEvents = discoveredEvents.length;

    const seenMatchIds = new Set<string>();
    let matchesProcessed = 0;

    eventLoop: for (const rawEvent of discoveredEvents) {
      assertNotCancelled();
      if (matchesProcessed >= scope.maximumMatches) break;

      if (scope.excludeEventIds.includes(rawEvent.vlrEventId)) {
        summary.recordExcludedEvent("manually-excluded");
        continue;
      }
      if (scope.includeEventIds.length > 0 && !scope.includeEventIds.includes(rawEvent.vlrEventId)) {
        summary.recordExcludedEvent("not-in-include-list");
        continue;
      }

      const classification = classifyEvent(
        {
          providerEventId: rawEvent.vlrEventId,
          name: rawEvent.name,
          parentSeries: rawEvent.parentSeries,
          region: rawEvent.region,
          season: rawEvent.season,
          stage: rawEvent.stage,
          tags: rawEvent.rawCategoryLabels,
        },
        this.deps.eventOverrides,
      );

      if (classification.classification === "unknown") {
        summary.unknownEvents += 1;
        continue;
      }
      if (!isApprovedEventFamily(classification.classification)) {
        summary.recordExcludedEvent(classification.classification);
        continue;
      }
      if (!scope.eventFamilies.includes(classification.classification)) {
        summary.recordExcludedEvent("outside-requested-families");
        continue;
      }

      summary.includedEvents += 1;
      const normalizedEvent: NormalizedEvent = normalizeEvent(rawEvent, classification, parsedAt);

      if (!dryRun) {
        const existingEvent = await this.deps.store.getNormalizedEntity("event", normalizedEvent.internalId);
        const eventUpsert = await this.deps.store.upsertNormalizedEntity("event", normalizedEvent.internalId, normalizedEvent);
        summary.normalizedRecords += 1;
        if (!existingEvent) summary.insertedRecords += 1;
        else if (eventUpsert.changed) summary.updatedRecords += 1;
        else summary.unchangedRecords += 1;
      }

      let matchSummaries: readonly VlrMatchSummary[];
      try {
        matchSummaries = await this.deps.provider.discoverMatches(rawEvent.vlrEventId, { signal: options.signal });
      } catch (error) {
        summary.recordFailure({ stage: "discover-matches", externalId: rawEvent.vlrEventId, message: describeError(error) });
        continue;
      }
      summary.discoveredMatchLinks += matchSummaries.length;

      for (const matchSummary of matchSummaries) {
        assertNotCancelled();

        // A match already seen (from this or another event's listing) is
        // never re-fetched or re-normalized within a run — see requirement
        // 22 ("deduplicate match IDs across event pages"). It is still
        // counted so the run summary reports how many duplicate links were
        // discovered.
        if (seenMatchIds.has(matchSummary.vlrMatchId)) {
          summary.duplicateMatchLinks += 1;
          continue;
        }
        seenMatchIds.add(matchSummary.vlrMatchId);

        if (matchesProcessed >= scope.maximumMatches) break eventLoop;
        matchesProcessed += 1;

        const matchFailed = await this.processMatch(matchSummary, rawEvent.vlrEventId, normalizedEvent, scope, parsedAt, dryRun, summary, options.signal);
        if (matchFailed) hadFailure = true;
      }
    }

    const checkpointStatus = await this.finalizeCheckpoint(scope, discoveredEvents.map((event) => event.vlrEventId), parsedAt, dryRun, hadFailure);
    return summary.build(scope, dryRun, checkpointStatus);
  }

  private async processMatch(
    matchSummary: VlrMatchSummary,
    vlrEventId: string,
    normalizedEvent: NormalizedEvent,
    scope: BackfillScope,
    parsedAt: string,
    dryRun: boolean,
    summary: RunSummaryBuilder,
    signal: AbortSignal | undefined,
  ): Promise<boolean> {
    // A match already normalized as "completed" on a previous run is never
    // re-fetched — see TASK-042 requirement 8 ("do not restart already
    // completed match IDs") and requirement 9 ("resume automatically from
    // the last checkpoint"). Anything else (upcoming/live/postponed/
    // cancelled, or never normalized at all) is re-fetched every run, since
    // only a completed match's result is realistically immutable.
    if (!dryRun) {
      const existingMatch = await this.deps.store.getNormalizedEntity<NormalizedMatch>("match", deterministicInternalId("match", matchSummary.vlrMatchId));
      if (existingMatch?.status === "completed") {
        summary.skippedUnchangedMatches += 1;
        summary.completedMatches += 1;
        return false;
      }
    }

    let detail: VlrMatchDetail | null;
    try {
      detail = await this.deps.provider.getMatch(matchSummary.vlrMatchId, vlrEventId, { signal, statusHint: matchSummary.status });
    } catch (error) {
      summary.recordFailure({ stage: "fetch-match", externalId: matchSummary.vlrMatchId, message: describeError(error) });
      return true;
    }
    if (!detail) {
      summary.recordFailure({ stage: "fetch-match", externalId: matchSummary.vlrMatchId, message: "Match detail was not found." });
      return true;
    }

    summary.fetchedMatches += 1;
    summary.parsedRecords += 1;
    if (detail.status === "completed") summary.completedMatches += 1;
    else summary.nonCompletedMatches += 1;

    const teamAIdentity = resolveTeamIdentity(detail.teamAVlrTeamId, this.deps.teamMapping);
    const teamBIdentity = resolveTeamIdentity(detail.teamBVlrTeamId, this.deps.teamMapping);
    if (!teamAIdentity.mapped) summary.recordUnmappedTeam(teamAIdentity.internalId);
    if (!teamBIdentity.mapped) summary.recordUnmappedTeam(teamBIdentity.internalId);

    let normalizedMatch: NormalizedMatch;
    try {
      normalizedMatch = normalizeMatch({
        raw: detail,
        teamAIdentity,
        teamBIdentity,
        event: normalizedEvent,
        scopeStartDate: scope.startDate,
        scopeEndDate: scope.endDate,
        isDuplicate: false,
        isShowmatch: false,
        parsedAt,
      });
    } catch (error) {
      summary.recordFailure({ stage: "normalize", externalId: matchSummary.vlrMatchId, message: describeError(error) });
      return true;
    }

    summary.normalizedRecords += 1;
    summary.warnings += normalizedMatch.qualityFlags.length;
    if (normalizedMatch.trainingEligibility.eligible) summary.trainingEligibleMatches += 1;
    else summary.recordIneligibleMatch(normalizedMatch.trainingEligibility.reasons);

    if (dryRun) return false;

    try {
      const existing = await this.deps.store.getNormalizedEntity("match", normalizedMatch.internalId);
      const upsertResult = await this.deps.store.upsertNormalizedEntity("match", normalizedMatch.internalId, normalizedMatch);
      if (!existing) summary.insertedRecords += 1;
      else if (upsertResult.changed) summary.updatedRecords += 1;
      else {
        summary.unchangedRecords += 1;
        summary.skippedUnchangedMatches += 1;
      }
    } catch (error) {
      summary.recordFailure({ stage: "persist", externalId: matchSummary.vlrMatchId, message: describeError(error) });
      return true;
    }

    return false;
  }

  private async finalizeCheckpoint(
    scope: BackfillScope,
    discoveredEventIds: readonly string[],
    updatedAt: string,
    dryRun: boolean,
    hadFailure: boolean,
  ): Promise<RunSummary["checkpointStatus"]> {
    if (dryRun) return "skipped-dry-run";
    if (hadFailure) return "skipped-due-to-failure";
    // Hashed rather than used verbatim: the serialized scope is an
    // arbitrarily long JSON string and would exceed filesystem filename
    // limits on some platforms.
    await this.deps.store.writeEventDiscoveryCheckpoint(contentHash(serializeBackfillScope(scope)), {
      lastCompletedPage: 1,
      discoveredEventIds,
      updatedAt,
    });
    return "saved";
  }
}
