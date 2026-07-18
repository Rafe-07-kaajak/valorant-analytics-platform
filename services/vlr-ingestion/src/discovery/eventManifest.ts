import { classifyEvent, matchesExcludedNamePattern } from "../classification/eventClassification";
import { isApprovedEventFamily } from "../classification/eventFamily";
import type { EventClassification, ClassificationConfidence, ClassificationEvidence, EventClassificationResult } from "../classification/eventFamily";
import type { EventClassificationOverride } from "../classification/eventOverrides";
import { deriveTournamentLevel, normalizeEvent } from "../normalize/normalizeEvent";
import { contentHash } from "../normalize/contentHash";
import { serializeDiscoveryScopeIdentity } from "../scope/backfillScope";
import type { TournamentLevel, BackfillScope } from "../scope/backfillScope";
import type { EventDiscoveryCheckpoint, IngestionStore } from "../persistence/types";
import { PARSER_VERSION } from "../vlr/parsers/htmlUtils";
import { VALID_EVENT_STATUSES, isEventWithinScope } from "../vlr/realVlrProvider";
import type { VlrEventDiscoveryEntry } from "../vlr/parsers/eventDiscoveryParser";
import type { VlrEvent, VlrEventStatus } from "../vlr/schemas/raw";
import type { VlrIngestionProvider } from "../ingestion/vlrIngestionProvider";

/**
 * Event discovery manifest — TASK-042 requirement 4. One entry per event
 * discovered within the scope's date range, whether or not it was ultimately
 * included, so every exclusion is auditable rather than silent.
 */
export interface EventManifestEntry {
  readonly vlrEventId: string;
  readonly name: string;
  readonly sourceUrl: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly season?: string;
  readonly region?: string;
  readonly stage?: string;
  readonly listedMatchCount?: number;
  readonly tournamentLevel: TournamentLevel | "unknown";
  readonly classification: EventClassification;
  readonly confidence: ClassificationConfidence;
  readonly evidence: readonly ClassificationEvidence[];
  readonly inclusionStatus: "included" | "excluded" | "unknown";
  readonly exclusionReason?: string;
  readonly discoveredAt: string;
}

export interface EventDiscoveryManifest {
  readonly scopeStartDate: string;
  readonly scopeEndDate: string;
  readonly generatedAt: string;
  readonly entries: readonly EventManifestEntry[];
}

const EVENT_MANIFEST_KEY = "events-manifest";
export const EVENT_DISCOVERY_CHECKPOINT_KEY = "event-discovery";
/** Consecutive listing pages whose every dated candidate falls before the scope's start date, required before declaring the archive fully scanned. */
const CONSECUTIVE_PAST_BOUNDARY_PAGE_LIMIT = 5;
const DEFAULT_MAX_PAGES_PER_RUN = 400;

function classify(event: VlrEvent, overrides: ReadonlyMap<string, EventClassificationOverride>): EventClassificationResult {
  return classifyEvent(
    { providerEventId: event.vlrEventId, name: event.name, parentSeries: event.parentSeries, region: event.region, season: event.season, stage: event.stage, tags: event.rawCategoryLabels },
    overrides,
  );
}

function buildEntry(event: VlrEvent, classification: EventClassificationResult, scope: BackfillScope, discoveredAt: string): EventManifestEntry {
  let inclusionStatus: EventManifestEntry["inclusionStatus"];
  let exclusionReason: string | undefined;
  if (classification.classification === "unknown") {
    inclusionStatus = "unknown";
  } else if (!isApprovedEventFamily(classification.classification)) {
    inclusionStatus = "excluded";
    exclusionReason = classification.classification;
  } else if (!scope.eventFamilies.includes(classification.classification)) {
    inclusionStatus = "excluded";
    exclusionReason = "outside-requested-families";
  } else if (!isEventWithinScope(event, scope)) {
    // An approved-family event whose own date range never overlaps the
    // scope (e.g. "Champions Tour 2024: EMEA Stage 1", entirely months
    // before 2025-01-01) must never be included just because its
    // classification matched — the archive-boundary scan necessarily walks
    // a few pages past the boundary to *confirm* it, discovering exactly
    // this kind of out-of-range event along the way. A real bug caught via
    // TASK-042 live discovery: this check was previously computed but only
    // fed into the boundary heuristic, never into the inclusion decision
    // itself, letting hundreds of 2024 matches into the dataset.
    inclusionStatus = "excluded";
    exclusionReason = "outside-date-scope";
  } else {
    inclusionStatus = "included";
  }

  return {
    vlrEventId: event.vlrEventId,
    name: event.name,
    sourceUrl: event.eventUrl,
    startDate: event.startDateIso,
    endDate: event.endDateIso,
    season: event.season,
    region: event.region,
    stage: event.stage,
    listedMatchCount: event.listedMatchCount,
    tournamentLevel: deriveTournamentLevel(classification.classification),
    classification: classification.classification,
    confidence: classification.confidence,
    evidence: classification.evidence,
    inclusionStatus,
    exclusionReason,
    discoveredAt,
  };
}

/**
 * Runs live event discovery against a *bounded* provider (used by
 * `IngestionService`/fixtures/one-off smoke checks) and classifies every
 * candidate, producing the full audit manifest in a single pass. TASK-042's
 * actual historical-backfill discovery uses `discoverEventsResumable`
 * instead — this function remains for the simpler, non-resumable callers.
 */
export async function buildEventDiscoveryManifest(
  provider: VlrIngestionProvider,
  scope: BackfillScope,
  overrides: ReadonlyMap<string, EventClassificationOverride>,
  eventStore: IngestionStore,
  options?: { signal?: AbortSignal; now?: () => Date },
): Promise<EventDiscoveryManifest> {
  const now = options?.now ?? (() => new Date());
  const discoveredAt = now().toISOString();
  const rawEvents = await provider.discoverEvents(scope, { signal: options?.signal });

  const entries: EventManifestEntry[] = [];
  for (const event of rawEvents) {
    const classification = classify(event, overrides);
    const entry = buildEntry(event, classification, scope, discoveredAt);
    entries.push(entry);
    if (entry.inclusionStatus === "included") {
      const normalized = normalizeEvent(event, classification, discoveredAt);
      await eventStore.upsertNormalizedEntity("event", normalized.internalId, normalized);
    }
  }

  return { scopeStartDate: scope.startDate, scopeEndDate: scope.endDate, generatedAt: discoveredAt, entries };
}

export async function saveEventDiscoveryManifest(store: IngestionStore, manifest: EventDiscoveryManifest): Promise<void> {
  await store.recordDiscoverySummary(EVENT_MANIFEST_KEY, manifest);
}

export async function loadEventDiscoveryManifest(store: IngestionStore): Promise<EventDiscoveryManifest | null> {
  return store.getDiscoverySummary<EventDiscoveryManifest>(EVENT_MANIFEST_KEY);
}

/** The page-level primitives `discoverEventsResumable` needs — `RealVlrProvider` satisfies this structurally. */
export interface ResumableDiscoveryProvider {
  fetchEventListPage(page: number, options?: { signal?: AbortSignal }): Promise<readonly VlrEventDiscoveryEntry[]>;
  fetchEventDetail(vlrEventId: string, statusHint: VlrEventStatus, options?: { signal?: AbortSignal }): Promise<VlrEvent | null>;
}

export interface DiscoverEventsResumableOptions {
  readonly signal?: AbortSignal;
  readonly now?: () => Date;
  /** Ignores any existing checkpoint/manifest and starts over from page 1 — TASK-042 requirement 1's `--restart-discovery`. */
  readonly restart?: boolean;
  /** Bounds how many *listing pages* this single invocation scans — independent of `scope.maximumEvents`, which bounds candidates. Repeated invocations resume until `archiveComplete`. */
  readonly maxPagesThisRun?: number;
  readonly onPage?: (page: number, candidatesOnPage: number, totalKnownEvents: number) => void;
  readonly onEventCandidate?: (vlrEventId: string, included: boolean) => void;
}

export interface DiscoverEventsResumableResult {
  readonly manifest: EventDiscoveryManifest;
  readonly checkpoint: EventDiscoveryCheckpoint;
  readonly pagesScannedThisRun: number;
  readonly startedFresh: boolean;
  readonly scopeOrParserMismatch: boolean;
  readonly archiveComplete: boolean;
}

/**
 * Resumable, checkpointed, idempotent-merge event discovery — TASK-042
 * requirement 1. Safe to invoke repeatedly: each call resumes from the
 * persisted checkpoint's page cursor, never re-fetches a previously-verified
 * event's detail page, and only declares `archiveComplete` once several
 * consecutive listing pages produce no candidate dated on/after the scope's
 * start date. A scope-identity or parser-version mismatch against the
 * persisted checkpoint is never silently resumed — it is reported via
 * `scopeOrParserMismatch` and treated as a fresh start (old, potentially
 * stale-parser-produced entries are not trusted going forward, though they
 * remain in the store for audit).
 */
export async function discoverEventsResumable(
  provider: ResumableDiscoveryProvider,
  scope: BackfillScope,
  overrides: ReadonlyMap<string, EventClassificationOverride>,
  store: IngestionStore,
  options: DiscoverEventsResumableOptions = {},
): Promise<DiscoverEventsResumableResult> {
  const now = options.now ?? (() => new Date());
  const scopeHash = contentHash(serializeDiscoveryScopeIdentity(scope));
  const maxPagesThisRun = options.maxPagesThisRun ?? DEFAULT_MAX_PAGES_PER_RUN;

  const existingCheckpoint = options.restart ? null : await store.readEventDiscoveryCheckpoint(EVENT_DISCOVERY_CHECKPOINT_KEY);
  const scopeOrParserMismatch = existingCheckpoint !== null && (existingCheckpoint.scopeHash !== scopeHash || existingCheckpoint.parserVersion !== PARSER_VERSION);
  const startedFresh = Boolean(options.restart) || scopeOrParserMismatch || existingCheckpoint === null;

  const existingManifest = startedFresh ? null : await loadEventDiscoveryManifest(store);
  const entries: EventManifestEntry[] = existingManifest ? [...existingManifest.entries] : [];
  const knownIds = new Set(entries.map((e) => e.vlrEventId));

  // Already fully scanned in a prior run against this exact campaign: nothing to do.
  if (!startedFresh && existingCheckpoint?.archiveComplete) {
    return {
      manifest: existingManifest ?? { scopeStartDate: scope.startDate, scopeEndDate: scope.endDate, generatedAt: now().toISOString(), entries },
      checkpoint: existingCheckpoint,
      pagesScannedThisRun: 0,
      startedFresh: false,
      scopeOrParserMismatch: false,
      archiveComplete: true,
    };
  }

  const startPage = !startedFresh && existingCheckpoint ? existingCheckpoint.lastCompletedPage + 1 : 1;
  let page = startPage;
  let pagesScannedThisRun = 0;
  let consecutivePastBoundaryPages = 0;
  let archiveComplete = false;
  let checkpoint: EventDiscoveryCheckpoint = existingCheckpoint && !startedFresh
    ? existingCheckpoint
    : { lastCompletedPage: 0, discoveredEventIds: [...knownIds], updatedAt: now().toISOString(), scopeHash, parserVersion: PARSER_VERSION, archiveComplete: false };

  while (pagesScannedThisRun < maxPagesThisRun) {
    if (options.signal?.aborted) break;

    const listingEntries = await provider.fetchEventListPage(page, { signal: options.signal });
    pagesScannedThisRun += 1;

    if (listingEntries.length === 0) {
      archiveComplete = true;
      checkpoint = { lastCompletedPage: page, discoveredEventIds: [...knownIds], updatedAt: now().toISOString(), scopeHash, parserVersion: PARSER_VERSION, archiveComplete: true };
      await store.writeEventDiscoveryCheckpoint(EVENT_DISCOVERY_CHECKPOINT_KEY, checkpoint);
      break;
    }

    let candidatesOnPage = 0;
    let pageHadInRangeCandidate = false;
    let pageHadDatedCandidate = false;
    let pageAllDatedBeforeStart = true;
    const scopeStartIso = `${scope.startDate}T00:00:00.000Z`;

    for (const listingEntry of listingEntries) {
      if (knownIds.has(listingEntry.vlrEventId)) continue; // already verified (this run or a prior one) — never re-fetched

      const statusHint = VALID_EVENT_STATUSES.find((status) => status === listingEntry.statusRaw);
      if (statusHint !== "completed" && statusHint !== "ongoing") continue;
      if (matchesExcludedNamePattern(listingEntry.name)) continue;
      candidatesOnPage += 1;
      knownIds.add(listingEntry.vlrEventId);

      if (options.signal?.aborted) break;

      let event: VlrEvent | null;
      try {
        event = await provider.fetchEventDetail(listingEntry.vlrEventId, statusHint, { signal: options.signal });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await store.recordFailure({ entityType: "event", externalId: listingEntry.vlrEventId, sourceUrl: listingEntry.eventUrl, operation: "discover-event-detail", errorCode: "fetch_failed", retryable: true, safeMessage: message }, now().toISOString());
        options.onEventCandidate?.(listingEntry.vlrEventId, false);
        continue;
      }
      if (!event) {
        await store.recordFailure(
          { entityType: "event", externalId: listingEntry.vlrEventId, sourceUrl: listingEntry.eventUrl, operation: "discover-event-detail", errorCode: "parse_failure", retryable: false, safeMessage: "Event detail page did not parse to a valid record." },
          now().toISOString(),
        );
        options.onEventCandidate?.(listingEntry.vlrEventId, false);
        continue;
      }

      const classification = classify(event, overrides);
      const manifestEntry = buildEntry(event, classification, scope, now().toISOString());
      entries.push(manifestEntry);
      if (manifestEntry.inclusionStatus === "included") {
        const normalized = normalizeEvent(event, classification, now().toISOString());
        await store.upsertNormalizedEntity("event", normalized.internalId, normalized);
      }

      const withinScope = isEventWithinScope(event, scope);
      options.onEventCandidate?.(listingEntry.vlrEventId, withinScope);
      if (withinScope) pageHadInRangeCandidate = true;

      const eventEnd = event.endDateIso ?? event.startDateIso;
      if (eventEnd) {
        pageHadDatedCandidate = true;
        if (eventEnd >= scopeStartIso) pageAllDatedBeforeStart = false;
      }
    }

    checkpoint = { lastCompletedPage: page, discoveredEventIds: [...knownIds], updatedAt: now().toISOString(), scopeHash, parserVersion: PARSER_VERSION, archiveComplete: false };
    await store.writeEventDiscoveryCheckpoint(EVENT_DISCOVERY_CHECKPOINT_KEY, checkpoint);
    await saveEventDiscoveryManifest(store, { scopeStartDate: scope.startDate, scopeEndDate: scope.endDate, generatedAt: now().toISOString(), entries });

    options.onPage?.(page, candidatesOnPage, entries.length);

    if (pageHadDatedCandidate && pageAllDatedBeforeStart) consecutivePastBoundaryPages += 1;
    else if (pageHadInRangeCandidate) consecutivePastBoundaryPages = 0;
    // A page with zero dated candidates at all (every entry excluded by
    // name/status) is ambiguous — it neither confirms nor refutes having
    // passed the boundary, so the counter is left unchanged.

    if (consecutivePastBoundaryPages >= CONSECUTIVE_PAST_BOUNDARY_PAGE_LIMIT) {
      archiveComplete = true;
      checkpoint = { ...checkpoint, archiveComplete: true };
      await store.writeEventDiscoveryCheckpoint(EVENT_DISCOVERY_CHECKPOINT_KEY, checkpoint);
      break;
    }

    page += 1;
  }

  const manifest: EventDiscoveryManifest = { scopeStartDate: scope.startDate, scopeEndDate: scope.endDate, generatedAt: now().toISOString(), entries };
  return { manifest, checkpoint, pagesScannedThisRun, startedFresh, scopeOrParserMismatch, archiveComplete };
}
