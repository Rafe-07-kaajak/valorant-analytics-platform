import { matchesExcludedNamePattern } from "../classification/eventClassification";
import type { VlrIngestionConfig } from "../env";
import { IngestionError } from "../errors";
import type { VlrFetchOptions, VlrIngestionProvider } from "../ingestion/vlrIngestionProvider";
import type { BackfillScope } from "../scope/backfillScope";
import { VlrHttpClient } from "./httpClient";
import { parseEventDiscoveryPage } from "./parsers/eventDiscoveryParser";
import type { VlrEventDiscoveryEntry } from "./parsers/eventDiscoveryParser";
import { parseEventPage } from "./parsers/eventParser";
import { parseMatchDetailPage } from "./parsers/matchDetailParser";
import { detectNextMatchListPageUrl, parseMatchListPage } from "./parsers/matchListParser";
import type { VlrEvent, VlrEventStatus, VlrMatchDetail, VlrMatchStatus, VlrMatchSummary } from "./schemas/raw";
import { assertApprovedUrl, buildEventListUrl, buildEventMatchesUrl, buildEventUrl, buildMatchUrl } from "./urlBuilder";

/**
 * Live VLR provider — TASK-042. Implements the same `VlrIngestionProvider`
 * contract `FixtureVlrProvider` implements (TASK-041), but backed by real
 * HTTP requests through `VlrHttpClient` (which itself enforces the network
 * kill switch, rate limiting, redirect validation, and response bounds — see
 * docs/29-vlr-data-ingestion-foundation.md). Nothing here makes a request
 * during construction or module import; every request happens only when
 * a fetch method is actually called and only because `VlrHttpClient.fetchHtml`
 * itself refuses to run unless `VLR_NETWORK_ENABLED=true`.
 *
 * Also exposes page-level primitives (`fetchEventListPage`, `fetchEventDetail`)
 * beyond the base `VlrIngestionProvider` contract, so `discovery/eventManifest.ts`'s
 * resumable orchestrator can checkpoint between pages instead of only ever
 * getting a single opaque `discoverEvents()` result.
 */
export interface RealVlrProviderProgress {
  onDiscoveryPage?(page: number, candidatesSeen: number, includedSoFar: number): void;
  onEventCandidate?(vlrEventId: string, includedInScope: boolean): void;
}

export const VALID_EVENT_STATUSES: readonly VlrEventStatus[] = ["upcoming", "ongoing", "completed"];
const MAX_DISCOVERY_PAGES = 400;
const CONSECUTIVE_OUT_OF_RANGE_PAGE_LIMIT = 5;

export function isEventWithinScope(event: Pick<VlrEvent, "startDateIso" | "endDateIso">, scope: Pick<BackfillScope, "startDate" | "endDate">): boolean {
  const start = event.startDateIso ?? event.endDateIso;
  const end = event.endDateIso ?? event.startDateIso;
  if (!start || !end) return false;
  const scopeStart = `${scope.startDate}T00:00:00.000Z`;
  const scopeEnd = `${scope.endDate}T23:59:59.999Z`;
  return end >= scopeStart && start <= scopeEnd;
}

export class RealVlrProvider implements VlrIngestionProvider {
  private readonly config: VlrIngestionConfig;
  private readonly client: VlrHttpClient;
  private readonly progress?: RealVlrProviderProgress;

  constructor(config: VlrIngestionConfig, client: VlrHttpClient = new VlrHttpClient(config), progress?: RealVlrProviderProgress) {
    this.config = config;
    this.client = client;
    this.progress = progress;
  }

  private assertNotCancelled(signal: AbortSignal | undefined): void {
    if (signal?.aborted) throw new IngestionError("cancelled", "Live discovery/fetch was cancelled.");
  }

  /** Fetches and parses one `/events?page=N` listing page. Never classifies or filters — that's the orchestrator's job. */
  async fetchEventListPage(page: number, options?: VlrFetchOptions): Promise<readonly VlrEventDiscoveryEntry[]> {
    this.assertNotCancelled(options?.signal);
    const listUrl = buildEventListUrl(this.config.baseUrl, this.config.approvedHost, page);
    const listResponse = await this.client.fetchHtml(listUrl, { signal: options?.signal });
    const listResult = parseEventDiscoveryPage(listResponse.html, { sourceUrl: listResponse.finalUrl });
    if (!listResult.value) {
      throw new IngestionError("parse_failure", `Event discovery page ${page} failed to parse: ${listResult.errors.map((e) => e.message).join("; ")}`);
    }
    return listResult.value;
  }

  /** Fetches and parses one event's detail page. Returns null (not a throw) on a parse failure, so a caller can record it as a per-event failure and continue. */
  async fetchEventDetail(vlrEventId: string, statusHint: VlrEventStatus, options?: VlrFetchOptions): Promise<VlrEvent | null> {
    this.assertNotCancelled(options?.signal);
    const eventUrl = buildEventUrl(this.config.baseUrl, this.config.approvedHost, vlrEventId);
    const eventResponse = await this.client.fetchHtml(eventUrl, { signal: options?.signal });
    const eventResult = parseEventPage(eventResponse.html, { sourceUrl: eventResponse.finalUrl, fetchedAt: new Date().toISOString(), statusHint });
    return eventResult.value;
  }

  /**
   * Bounded, single-shot event discovery — the base `VlrIngestionProvider`
   * contract's method, used directly by `IngestionService` (the TASK-041
   * fixture-style coordinator) and by the live smoke/one-off paths. TASK-042's
   * actual historical-backfill discovery uses `discovery/eventManifest.ts`'s
   * `discoverEventsResumable` instead, which checkpoints between pages via
   * `fetchEventListPage`/`fetchEventDetail` above rather than calling this.
   */
  async discoverEvents(scope: BackfillScope, options?: VlrFetchOptions): Promise<readonly VlrEvent[]> {
    const events: VlrEvent[] = [];
    const seenIds = new Set<string>();
    let consecutiveOutOfRangePages = 0;

    for (let page = 1; page <= MAX_DISCOVERY_PAGES; page += 1) {
      this.assertNotCancelled(options?.signal);
      if (events.length >= scope.maximumEvents) break;

      const entries = await this.fetchEventListPage(page, options);
      if (entries.length === 0) break;

      let pageHadInRangeCandidate = false;
      let candidatesOnPage = 0;

      for (const entry of entries) {
        if (seenIds.has(entry.vlrEventId)) continue;
        seenIds.add(entry.vlrEventId);

        const statusHint = VALID_EVENT_STATUSES.find((status) => status === entry.statusRaw);
        if (statusHint !== "completed" && statusHint !== "ongoing") continue;
        if (matchesExcludedNamePattern(entry.name)) continue;
        candidatesOnPage += 1;

        this.assertNotCancelled(options?.signal);
        let event: VlrEvent | null;
        try {
          event = await this.fetchEventDetail(entry.vlrEventId, statusHint, options);
        } catch (error) {
          if (error instanceof IngestionError && error.code === "cancelled") throw error;
          this.progress?.onEventCandidate?.(entry.vlrEventId, false);
          continue;
        }
        if (!event) {
          this.progress?.onEventCandidate?.(entry.vlrEventId, false);
          continue;
        }

        const included = isEventWithinScope(event, scope);
        this.progress?.onEventCandidate?.(entry.vlrEventId, included);
        if (included) {
          events.push(event);
          pageHadInRangeCandidate = true;
          if (events.length >= scope.maximumEvents) break;
        }
      }

      this.progress?.onDiscoveryPage?.(page, candidatesOnPage, events.length);
      consecutiveOutOfRangePages = pageHadInRangeCandidate ? 0 : consecutiveOutOfRangePages + 1;
      if (consecutiveOutOfRangePages >= CONSECUTIVE_OUT_OF_RANGE_PAGE_LIMIT) break;
    }

    return events;
  }

  async discoverMatches(vlrEventId: string, options?: VlrFetchOptions): Promise<readonly VlrMatchSummary[]> {
    const { summaries } = await this.fetchMatchListPage(vlrEventId, undefined, options);
    return summaries;
  }

  /**
   * Fetches one match-list page for an event — the canonical first page when
   * `pageUrl` is omitted, or a specific cursor URL (validated against the
   * approved host, same as every other request) when following a detected
   * next-page link. See `detectNextMatchListPageUrl` and TASK-042
   * requirement 2: live verification found no event actually paginates, so
   * `nextPageUrl` is `undefined` in every real case observed, but this stays
   * cursor-capable rather than assuming a single page is always enough.
   */
  async fetchMatchListPage(vlrEventId: string, pageUrl?: string, options?: VlrFetchOptions): Promise<{ summaries: readonly VlrMatchSummary[]; nextPageUrl?: string }> {
    this.assertNotCancelled(options?.signal);
    const url = pageUrl ? new URL(pageUrl) : buildEventMatchesUrl(this.config.baseUrl, this.config.approvedHost, vlrEventId);
    if (pageUrl) assertApprovedUrl(url, this.config.approvedHost);
    const response = await this.client.fetchHtml(url, { signal: options?.signal });
    const result = parseMatchListPage(response.html, { sourceUrl: response.finalUrl, fetchedAt: new Date().toISOString(), vlrEventId });
    if (!result.value) {
      throw new IngestionError("parse_failure", `Match list page for event ${vlrEventId} failed to parse: ${result.errors.map((e) => e.message).join("; ")}`);
    }
    const nextPageUrl = detectNextMatchListPageUrl(response.html, response.finalUrl);
    return { summaries: result.value, nextPageUrl };
  }

  async getMatch(vlrMatchId: string, vlrEventId: string, options?: VlrFetchOptions & { statusHint?: VlrMatchStatus }): Promise<VlrMatchDetail | null> {
    this.assertNotCancelled(options?.signal);
    const url = buildMatchUrl(this.config.baseUrl, this.config.approvedHost, vlrMatchId);
    const response = await this.client.fetchHtml(url, { signal: options?.signal });
    const result = parseMatchDetailPage(response.html, { sourceUrl: response.finalUrl, fetchedAt: new Date().toISOString(), vlrEventId, statusHint: options?.statusHint });
    return result.value;
  }
}
