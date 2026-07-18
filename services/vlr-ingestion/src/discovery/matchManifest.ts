import type { EventClassification } from "../classification/eventFamily";
import type { IngestionStore, MatchDiscoveryCheckpoint } from "../persistence/types";
import type { VlrMatchStatus, VlrMatchSummary } from "../vlr/schemas/raw";
import type { VlrIngestionProvider } from "../ingestion/vlrIngestionProvider";
import type { EventDiscoveryManifest } from "./eventManifest";

/**
 * Match discovery manifest — TASK-042 requirement 6. Built only from
 * `EventDiscoveryManifest` entries with `inclusionStatus: "included"` — a
 * match is never discovered under an excluded or unknown event.
 */
export interface MatchManifestEntry {
  readonly vlrMatchId: string;
  readonly eventId: string;
  readonly eventFamily: EventClassification;
  readonly matchUrl: string;
  readonly teamANameRaw?: string;
  readonly teamBNameRaw?: string;
  readonly listedStatus: VlrMatchStatus;
  readonly scheduledAtRaw?: string;
  readonly roundStageText?: string;
  readonly seriesFormatRaw?: string;
  readonly discoverySourceUrl: string;
  readonly discoveryTimestamp: string;
  readonly detailFetchStatus: "pending" | "fetched" | "failed" | "skipped-non-completed";
}

export interface MatchDiscoveryManifest {
  readonly generatedAt: string;
  readonly entries: readonly MatchManifestEntry[];
  readonly duplicateMatchLinks: number;
  readonly eventsWithFailedDiscovery: readonly string[];
}

const MATCH_MANIFEST_KEY = "matches-manifest";

/**
 * Discovers matches for every included event in `eventManifest`, deduping a
 * match ID that appears under more than one event (the first event it was
 * seen under wins — see TASK-042 requirement 6, "preserve event
 * association"). A per-event discovery failure is recorded and does not
 * abort the rest of the scan (requirement 22: "one failing stage never
 * aborts the whole run"). Non-resumable, single-pass — used by simpler
 * callers; `buildMatchDiscoveryManifestResumable` is TASK-042's actual
 * historical-backfill entry point.
 */
export async function buildMatchDiscoveryManifest(
  provider: VlrIngestionProvider,
  eventManifest: EventDiscoveryManifest,
  options?: { signal?: AbortSignal; now?: () => Date; onEventDiscovered?: (vlrEventId: string, matchCount: number) => void },
): Promise<MatchDiscoveryManifest> {
  const now = options?.now ?? (() => new Date());
  const entries: MatchManifestEntry[] = [];
  const seenMatchIds = new Set<string>();
  const eventsWithFailedDiscovery: string[] = [];
  let duplicateMatchLinks = 0;

  const includedEvents = eventManifest.entries.filter((entry) => entry.inclusionStatus === "included");

  for (const event of includedEvents) {
    if (options?.signal?.aborted) break;

    let summaries: readonly VlrMatchSummary[];
    try {
      summaries = await provider.discoverMatches(event.vlrEventId, { signal: options?.signal });
    } catch {
      eventsWithFailedDiscovery.push(event.vlrEventId);
      continue;
    }

    let matchCountForEvent = 0;
    const discoveryTimestamp = now().toISOString();
    for (const summary of summaries) {
      if (seenMatchIds.has(summary.vlrMatchId)) {
        duplicateMatchLinks += 1;
        continue;
      }
      seenMatchIds.add(summary.vlrMatchId);
      matchCountForEvent += 1;

      entries.push({
        vlrMatchId: summary.vlrMatchId,
        eventId: event.vlrEventId,
        eventFamily: event.classification,
        matchUrl: summary.matchUrl,
        teamANameRaw: summary.teamANameRaw,
        teamBNameRaw: summary.teamBNameRaw,
        listedStatus: summary.status,
        scheduledAtRaw: summary.scheduledAtRaw,
        roundStageText: summary.roundStageText,
        seriesFormatRaw: summary.seriesFormatRaw,
        discoverySourceUrl: summary.source.sourceUrl,
        discoveryTimestamp,
        detailFetchStatus: summary.status === "completed" ? "pending" : "skipped-non-completed",
      });
    }
    options?.onEventDiscovered?.(event.vlrEventId, matchCountForEvent);
  }

  return { generatedAt: now().toISOString(), entries, duplicateMatchLinks, eventsWithFailedDiscovery };
}

export async function saveMatchDiscoveryManifest(store: IngestionStore, manifest: MatchDiscoveryManifest): Promise<void> {
  await store.recordDiscoverySummary(MATCH_MANIFEST_KEY, manifest);
}

export async function loadMatchDiscoveryManifest(store: IngestionStore): Promise<MatchDiscoveryManifest | null> {
  return store.getDiscoverySummary<MatchDiscoveryManifest>(MATCH_MANIFEST_KEY);
}

/** The page-level primitive `buildMatchDiscoveryManifestResumable` needs — `RealVlrProvider` satisfies this structurally. */
export interface ResumableMatchDiscoveryProvider {
  fetchMatchListPage(vlrEventId: string, pageUrl: string | undefined, options?: { signal?: AbortSignal }): Promise<{ summaries: readonly VlrMatchSummary[]; nextPageUrl?: string }>;
}

export interface MatchDiscoveryResumableOptions {
  readonly signal?: AbortSignal;
  readonly now?: () => Date;
  readonly onEventDiscovered?: (vlrEventId: string, matchCount: number, verifiedComplete: boolean) => void;
}

/**
 * Resumable, per-event-checkpointed match discovery — TASK-042 requirement
 * 2/6. An event whose checkpoint is already `verifiedComplete` is skipped
 * entirely (no re-fetch). For every other included event, follows
 * `nextPageUrl` cursors until exhausted (defensive — see
 * `detectNextMatchListPageUrl`; no live event required more than one page),
 * then verifies the discovered count against the event's own listed
 * "Matches (N)" total (`EventManifestEntry.listedMatchCount`) before marking
 * it complete. A count mismatch is recorded as a warning-level anomaly
 * rather than silently accepted, and the event is *not* marked complete —
 * see `verifiedComplete` in the returned checkpoint and
 * `completenessValidation.ts`'s "no incomplete event pagination" rule.
 */
export async function buildMatchDiscoveryManifestResumable(
  provider: ResumableMatchDiscoveryProvider,
  eventManifest: EventDiscoveryManifest,
  store: IngestionStore,
  options: MatchDiscoveryResumableOptions = {},
): Promise<MatchDiscoveryManifest & { readonly countMismatchEvents: readonly string[] }> {
  const now = options.now ?? (() => new Date());
  const existingManifest = await loadMatchDiscoveryManifest(store);
  const includedEvents = eventManifest.entries.filter((entry) => entry.inclusionStatus === "included");
  const includedEventIds = new Set(includedEvents.map((e) => e.vlrEventId));

  // Prune any merged-in entry whose parent event is no longer included —
  // e.g. a prior event-discovery run classified it as included and this one
  // (after a classification fix, an override change, or a
  // `--restart-discovery`) correctly excludes it. The merge model keeps
  // discovery incremental for events that are *still* included, but must
  // never let a stale entry for a now-excluded event silently linger in the
  // "current" manifest — see TASK-042 live discovery, where exactly this
  // happened after a date-scope classification bug was fixed but the
  // previously-merged match manifest still carried the wrongly-included
  // events' matches.
  const entries: MatchManifestEntry[] = existingManifest ? existingManifest.entries.filter((e) => includedEventIds.has(e.eventId)) : [];
  const seenMatchIds = new Set(entries.map((e) => e.vlrMatchId));
  const eventsWithFailedDiscovery: string[] = existingManifest ? existingManifest.eventsWithFailedDiscovery.filter((id) => includedEventIds.has(id)) : [];
  let duplicateMatchLinks = existingManifest?.duplicateMatchLinks ?? 0;
  const countMismatchEvents: string[] = [];

  for (const event of includedEvents) {
    if (options.signal?.aborted) break;

    const existingCheckpoint = await store.readMatchDiscoveryCheckpoint(event.vlrEventId);
    if (existingCheckpoint?.verifiedComplete) {
      options.onEventDiscovered?.(event.vlrEventId, existingCheckpoint.discoveredMatchIds.length, true);
      continue; // never re-fetched — TASK-042 requirement 1/2's "no duplicate event-detail fetch for already verified events", applied here to match discovery too.
    }

    const discoveredIdsForEvent = new Set<string>(existingCheckpoint?.discoveredMatchIds ?? []);
    let pageUrl: string | undefined;
    let pagesFollowed = 0;
    let discoveryFailed = false;
    const discoveryTimestamp = now().toISOString();

    do {
      let result: { summaries: readonly VlrMatchSummary[]; nextPageUrl?: string };
      try {
        result = await provider.fetchMatchListPage(event.vlrEventId, pageUrl, { signal: options.signal });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await store.recordFailure({ entityType: "event", externalId: event.vlrEventId, sourceUrl: event.sourceUrl, operation: "discover-matches", errorCode: "fetch_failed", retryable: true, safeMessage: message }, discoveryTimestamp);
        eventsWithFailedDiscovery.push(event.vlrEventId);
        discoveryFailed = true;
        break;
      }

      for (const summary of result.summaries) {
        discoveredIdsForEvent.add(summary.vlrMatchId);
        if (seenMatchIds.has(summary.vlrMatchId)) {
          duplicateMatchLinks += 1;
          continue;
        }
        seenMatchIds.add(summary.vlrMatchId);

        entries.push({
          vlrMatchId: summary.vlrMatchId,
          eventId: event.vlrEventId,
          eventFamily: event.classification,
          matchUrl: summary.matchUrl,
          teamANameRaw: summary.teamANameRaw,
          teamBNameRaw: summary.teamBNameRaw,
          listedStatus: summary.status,
          scheduledAtRaw: summary.scheduledAtRaw,
          roundStageText: summary.roundStageText,
          seriesFormatRaw: summary.seriesFormatRaw,
          discoverySourceUrl: summary.source.sourceUrl,
          discoveryTimestamp,
          detailFetchStatus: summary.status === "completed" ? "pending" : "skipped-non-completed",
        });
      }

      pageUrl = result.nextPageUrl;
      pagesFollowed += 1;
    } while (pageUrl && pagesFollowed < 50); // 50 is a generous, still-bounded safety ceiling — no real event has needed a 2nd page at all.

    if (discoveryFailed) continue;

    const expectedCount = event.listedMatchCount;
    const verifiedComplete = expectedCount === undefined || discoveredIdsForEvent.size >= expectedCount;
    if (expectedCount !== undefined && discoveredIdsForEvent.size < expectedCount) {
      countMismatchEvents.push(event.vlrEventId);
    }

    const checkpoint: MatchDiscoveryCheckpoint = { discoveredMatchIds: [...discoveredIdsForEvent], updatedAt: now().toISOString(), expectedMatchCount: expectedCount, verifiedComplete };
    await store.writeMatchDiscoveryCheckpoint(event.vlrEventId, checkpoint);
    await saveMatchDiscoveryManifest(store, { generatedAt: now().toISOString(), entries, duplicateMatchLinks, eventsWithFailedDiscovery });

    options.onEventDiscovered?.(event.vlrEventId, discoveredIdsForEvent.size, verifiedComplete);
  }

  const manifest = { generatedAt: now().toISOString(), entries, duplicateMatchLinks, eventsWithFailedDiscovery };
  await saveMatchDiscoveryManifest(store, manifest);
  return { ...manifest, countMismatchEvents };
}
