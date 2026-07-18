import type { RawSourceMetadata, VlrMatchStatus, VlrMatchSummary } from "../schemas/raw";
import { extractAttribute, extractIdFromUrl, extractText, parseHtmlDocument, PARSER_VERSION } from "./htmlUtils";
import type { ParseIssue, ParseOutcome } from "./htmlUtils";

/**
 * Match-list page parser (one event's matches) — see
 * docs/29-vlr-data-ingestion-foundation.md ("Parsing") and TASK-041
 * requirement 14. Feeds the ingestion coordinator's automatic match
 * discovery; deduplication across event pages happens one layer up, in the
 * ingestion coordinator, since a single page parse has no visibility into
 * matches discovered from other pages.
 */

const MATCH_ID_FROM_HREF = /^\/(\d+)/;
const VALID_STATUSES: readonly VlrMatchStatus[] = ["upcoming", "live", "completed", "postponed", "cancelled"];

export function parseMatchListPage(html: string, source: { sourceUrl: string; fetchedAt: string; vlrEventId: string }): ParseOutcome<readonly VlrMatchSummary[]> {
  const document = parseHtmlDocument(html);
  const errors: ParseIssue[] = [];
  const warnings: ParseIssue[] = [];

  const root = document.querySelector(".match-list");
  if (!root) {
    errors.push({ code: "critical_field_missing", message: "No .match-list root element found.", selector: ".match-list" });
    return { value: null, warnings, errors, parserVersion: PARSER_VERSION };
  }

  const summaries: VlrMatchSummary[] = [];
  const items = Array.from(root.querySelectorAll(".match-list-item"));

  for (const item of items) {
    const href = extractAttribute(item, "href");
    const vlrMatchId = href ? extractIdFromUrl(href, MATCH_ID_FROM_HREF) : undefined;
    const teamElements = Array.from(item.querySelectorAll(".match-team"));
    const teamAVlrTeamId = extractAttribute(teamElements[0], "data-team-id");
    const teamBVlrTeamId = extractAttribute(teamElements[1], "data-team-id");
    const statusRaw = extractAttribute(item, "data-status")?.toLowerCase();
    const status = VALID_STATUSES.find((candidate) => candidate === statusRaw);

    if (!vlrMatchId || !teamAVlrTeamId || !teamBVlrTeamId || !status) {
      warnings.push({ code: "partial_record", message: "Skipped a match-list item missing an identity-critical field (ID, teams, or status).", selector: ".match-list-item" });
      continue;
    }

    const sourceMetadata: RawSourceMetadata = { sourceUrl: source.sourceUrl, fetchedAt: source.fetchedAt, parserVersion: PARSER_VERSION };

    summaries.push({
      vlrMatchId,
      matchUrl: new URL(href!, source.sourceUrl).toString(),
      teamAVlrTeamId,
      teamBVlrTeamId,
      scheduledAtRaw: extractAttribute(item, "data-scheduled"),
      scheduledAtIso: isIsoTimestamp(extractAttribute(item, "data-scheduled")) ? extractAttribute(item, "data-scheduled") : undefined,
      status,
      vlrEventId: source.vlrEventId,
      roundStageText: extractText(item.querySelector(".match-round")),
      seriesFormatRaw: extractText(item.querySelector(".match-series-format")),
      source: sourceMetadata,
    });
  }

  if (items.length > 0 && summaries.length === 0) {
    warnings.push({ code: "source_markup_changed", message: "Every match-list item failed to parse; the page structure may have changed." });
  }

  return { value: summaries, warnings, errors, parserVersion: PARSER_VERSION };
}

function isIsoTimestamp(value: string | undefined): boolean {
  if (!value) return false;
  return !Number.isNaN(Date.parse(value));
}
