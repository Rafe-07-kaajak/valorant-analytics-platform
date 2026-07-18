import { IngestionError } from "../errors";
import { isWithinDateScope } from "../normalize/dateNormalization";
import type { BackfillScope } from "../scope/backfillScope";
import { readFixtureFile } from "../vlr/fixtureLoader";
import { parseEventDiscoveryPage } from "../vlr/parsers/eventDiscoveryParser";
import { parseEventPage } from "../vlr/parsers/eventParser";
import { parseMatchDetailPage } from "../vlr/parsers/matchDetailParser";
import { parseMatchListPage } from "../vlr/parsers/matchListParser";
import type { VlrEvent, VlrEventStatus, VlrMatchDetail, VlrMatchStatus, VlrMatchSummary } from "../vlr/schemas/raw";
import type { VlrIngestionProvider } from "./vlrIngestionProvider";

const VALID_EVENT_STATUSES: readonly VlrEventStatus[] = ["upcoming", "ongoing", "completed"];

/**
 * Fixture-backed provider behind `pnpm ingest:fixtures` — see
 * docs/29-vlr-data-ingestion-foundation.md ("Fixture Testing") and
 * TASK-041 requirement 13/22/23. Performs zero network access: every
 * "discovery" and "fetch" reads a synthetic fixture file instead.
 */
const EVENT_FIXTURES: Readonly<Record<string, string>> = {
  "2001": "event-page-vct-americas.html",
  "3001": "event-page-masters.html",
  "5001": "event-page-excluded-tier2.html",
};

const MATCH_LIST_FIXTURES: Readonly<Record<string, string>> = {
  "2001": "match-list-page.html",
};

const MATCH_DETAIL_FIXTURES: Readonly<Record<string, string>> = {
  "347540": "match-completed.html",
  "347541": "match-completed-2.html",
};

export class FixtureVlrProvider implements VlrIngestionProvider {
  private readonly fetchedAt: string;

  constructor(fetchedAt: string = new Date().toISOString()) {
    this.fetchedAt = fetchedAt;
  }

  async discoverEvents(scope: BackfillScope): Promise<readonly VlrEvent[]> {
    const discoveryHtml = readFixtureFile("event-discovery-page.html");
    const discoveryResult = parseEventDiscoveryPage(discoveryHtml, { sourceUrl: "https://www.vlr.gg/events?page=1" });
    if (!discoveryResult.value) {
      throw new IngestionError("parse_failure", "Fixture event discovery page failed to parse.");
    }

    const uniqueIds = [...new Set(discoveryResult.value.map((entry) => entry.vlrEventId))].slice(0, scope.maximumEvents);
    const events: VlrEvent[] = [];
    for (const vlrEventId of uniqueIds) {
      const fixtureName = EVENT_FIXTURES[vlrEventId];
      if (!fixtureName) continue;
      const eventHtml = readFixtureFile(fixtureName);
      const statusHint = VALID_EVENT_STATUSES.find((candidate) => candidate === discoveryResult.value!.find((entry) => entry.vlrEventId === vlrEventId)?.statusRaw);
      const eventResult = parseEventPage(eventHtml, { sourceUrl: `https://www.vlr.gg/event/${vlrEventId}/name`, fetchedAt: this.fetchedAt, statusHint });
      if (!eventResult.value) continue;
      if (eventResult.value.startDateIso && !isWithinDateScope(eventResult.value.startDateIso, scope.startDate, scope.endDate)) continue;
      events.push(eventResult.value);
    }
    return events;
  }

  async discoverMatches(vlrEventId: string): Promise<readonly VlrMatchSummary[]> {
    const fixtureName = MATCH_LIST_FIXTURES[vlrEventId];
    if (!fixtureName) return [];
    const html = readFixtureFile(fixtureName);
    const result = parseMatchListPage(html, { sourceUrl: `https://www.vlr.gg/event/matches/${vlrEventId}`, fetchedAt: this.fetchedAt, vlrEventId });
    return result.value ?? [];
  }

  async getMatch(vlrMatchId: string, vlrEventId: string, options?: { statusHint?: VlrMatchStatus }): Promise<VlrMatchDetail | null> {
    const fixtureName = MATCH_DETAIL_FIXTURES[vlrMatchId];
    if (!fixtureName) return null;
    const html = readFixtureFile(fixtureName);
    const result = parseMatchDetailPage(html, { sourceUrl: `https://www.vlr.gg/${vlrMatchId}/match`, fetchedAt: this.fetchedAt, vlrEventId, statusHint: options?.statusHint });
    return result.value;
  }
}
