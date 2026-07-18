import type { RawSourceMetadata, VlrMatchStatus, VlrMatchSummary } from "../schemas/raw";
import { extractAttribute, extractIdFromUrl, extractText, parseHtmlDocument, PARSER_VERSION } from "./htmlUtils";
import type { ParseIssue, ParseOutcome } from "./htmlUtils";

/**
 * Match-list page parser (one event's matches) — see
 * docs/29-vlr-data-ingestion-foundation.md ("Parsing"), TASK-041
 * requirement 14, and TASK-042's live-markup verification. Feeds the
 * ingestion coordinator's automatic match discovery; deduplication across
 * event pages happens one layer up, in the ingestion coordinator, since a
 * single page parse has no visibility into matches discovered from other
 * pages.
 *
 * Real `/event/matches/<id>` markup (verified live) has no single
 * `.match-list` wrapper — matches are `a.match-item` cards grouped under
 * `.wf-label.mod-large` day headings, which this parser walks in document
 * order to attach a (still ambiguous, no year) raw scheduled-time string to
 * each match. Team IDs are never present on this page — only team display
 * names — so `teamAVlrTeamId`/`teamBVlrTeamId` are left unset here; the
 * match-detail fetch is the only authoritative source for team identity.
 * An event page with genuinely zero matches (e.g. a not-yet-started event)
 * is a valid, non-fatal empty result, not a parse failure.
 */

const MATCH_ID_FROM_HREF = /^\/(\d+)/;

const STATUS_TEXT_LOOKUP: Readonly<Record<string, VlrMatchStatus>> = {
  completed: "completed",
  final: "completed",
  live: "live",
  upcoming: "upcoming",
  postponed: "postponed",
  cancelled: "cancelled",
  canceled: "cancelled",
};

function resolveStatus(item: Element): VlrMatchStatus | undefined {
  const statusText = extractText(item.querySelector(".ml-status"))?.toLowerCase();
  if (statusText && STATUS_TEXT_LOOKUP[statusText]) return STATUS_TEXT_LOOKUP[statusText];

  const statusContainer = item.querySelector(".ml");
  if (statusContainer) {
    for (const [key, status] of Object.entries(STATUS_TEXT_LOOKUP)) {
      if (statusContainer.classList.contains(`mod-${key}`)) return status;
    }
  }
  // No status badge at all and a scheduled time is shown: VLR's real
  // convention for a not-yet-started match with no live/completed marker.
  if (extractText(item.querySelector(".match-item-time"))) return "upcoming";
  return undefined;
}

export function parseMatchListPage(html: string, source: { sourceUrl: string; fetchedAt: string; vlrEventId: string }): ParseOutcome<readonly VlrMatchSummary[]> {
  const document = parseHtmlDocument(html);
  const errors: ParseIssue[] = [];
  const warnings: ParseIssue[] = [];

  const pageRoot = document.querySelector(".event-header") ?? document.querySelector(".wf-nav");
  if (!pageRoot) {
    errors.push({ code: "critical_field_missing", message: "No recognizable event page chrome (.event-header) found.", selector: ".event-header" });
    return { value: null, warnings, errors, parserVersion: PARSER_VERSION };
  }

  const summaries: VlrMatchSummary[] = [];
  let currentDayHeading: string | undefined;
  const walkedNodes = Array.from(document.querySelectorAll(".wf-label.mod-large, a.match-item"));

  for (const node of walkedNodes) {
    if (node.matches(".wf-label.mod-large")) {
      currentDayHeading = extractText(node);
      continue;
    }

    const item = node;
    const href = extractAttribute(item, "href");
    const vlrMatchId = href ? extractIdFromUrl(href, MATCH_ID_FROM_HREF) : undefined;
    const status = resolveStatus(item);

    if (!vlrMatchId || !status) {
      warnings.push({ code: "partial_record", message: "Skipped a match-list item missing an identity-critical field (ID or status).", selector: "a.match-item" });
      continue;
    }

    const teamNames = Array.from(item.querySelectorAll(".match-item-vs-team-name")).map((el) => extractText(el));
    const itemTime = extractText(item.querySelector(".match-item-time"));
    const scheduledAtRaw = [currentDayHeading, itemTime].filter((part): part is string => Boolean(part)).join(" ") || undefined;
    const eventText = extractText(item.querySelector(".match-item-event"));

    const sourceMetadata: RawSourceMetadata = { sourceUrl: source.sourceUrl, fetchedAt: source.fetchedAt, parserVersion: PARSER_VERSION };

    summaries.push({
      vlrMatchId,
      matchUrl: new URL(href!, source.sourceUrl).toString(),
      teamANameRaw: teamNames[0],
      teamBNameRaw: teamNames[1],
      scheduledAtRaw,
      status,
      vlrEventId: source.vlrEventId,
      roundStageText: eventText,
      source: sourceMetadata,
    });
  }

  if (walkedNodes.filter((node) => node.matches("a.match-item")).length > 0 && summaries.length === 0) {
    warnings.push({ code: "source_markup_changed", message: "Every match-list item failed to parse; the page structure may have changed." });
  }

  return { value: summaries, warnings, errors, parserVersion: PARSER_VERSION };
}

/**
 * Detects a cursor to a further match-list page, if the response indicates
 * one exists — TASK-042 requirement 2 ("pagination/cursor discovery where
 * VLR uses it"). Live-markup verification (a 48-match event, the largest
 * fetched during this task) found VLR's `/event/matches/<id>` page returns
 * every match in one response with no pagination markers of any kind — this
 * function is a defensive forward-compatibility check, not a confirmed
 * mechanism: it recognizes the conventional patterns a paginated listing
 * would use (`rel="next"`, a `.pagination`/`.mod-pagination` block, or a
 * "Load more" control with an href) so a future VLR change is *detected*
 * rather than silently truncating results. Returns `undefined` — "no further
 * page" — whenever none of these are present, which is what every live page
 * inspected during this task actually returned.
 */
export function detectNextMatchListPageUrl(html: string, sourceUrl: string): string | undefined {
  const document = parseHtmlDocument(html);
  const candidate =
    document.querySelector('a[rel="next"]') ??
    document.querySelector(".pagination a.mod-next, .mod-pagination a.mod-next") ??
    document.querySelector('a.mod-page[href]:not([aria-disabled="true"])[data-page-next]');
  const href = extractAttribute(candidate, "href");
  return href ? new URL(href, sourceUrl).toString() : undefined;
}
