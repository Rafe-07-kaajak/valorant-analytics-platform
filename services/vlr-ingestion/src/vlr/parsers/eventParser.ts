import type { RawSourceMetadata, VlrEvent, VlrEventStatus } from "../schemas/raw";
import { parseEventDateRangeText } from "../../normalize/dateNormalization";
import { extractAttribute, extractText, extractIdFromUrl, parseHtmlDocument, PARSER_VERSION, querySelectorAllText } from "./htmlUtils";
import type { ParseIssue, ParseOutcome } from "./htmlUtils";

/**
 * Event page parser — see docs/29-vlr-data-ingestion-foundation.md
 * ("Parsing"), TASK-041 requirement 14/15, and TASK-042's live-markup
 * verification. Produces the raw `VlrEvent` record only; family/tier
 * classification is a separate, later stage
 * (`classification/eventClassification.ts`) that consumes this output
 * rather than guessing inline.
 *
 * Real event-detail markup (verified live) has no `.event-page` wrapper and
 * — critically — no status text anywhere on the page itself; status
 * ("upcoming"/"ongoing"/"completed") only appears on the `/events` listing.
 * `statusHint` must therefore be supplied by the caller (the real provider
 * carries it from the discovery entry that led to this fetch); a fixture or
 * unit-test caller that omits it gets the same "unrecognized status"
 * failure TASK-041 defined, so this never silently fabricates a status.
 */

const EVENT_ID_FROM_URL = /\/event\/(\d+)/;
const VALID_STATUSES: readonly VlrEventStatus[] = ["upcoming", "ongoing", "completed"];
const REGION_QUERY_PATTERN = /\/vct\/\?region=/;
const STAGE_QUERY_PATTERN = /\/vct\/\?stage=/;

function findMetaValue(root: Element, labelText: string): string | undefined {
  const rows = Array.from(root.querySelectorAll(".event-header-main-meta > div"));
  for (const row of rows) {
    const label = extractText(row.querySelector(".label"));
    if (label?.toLowerCase() === labelText.toLowerCase()) {
      return extractText(row.querySelector(".value"));
    }
  }
  return undefined;
}

export function parseEventPage(html: string, source: { sourceUrl: string; fetchedAt: string; statusHint?: VlrEventStatus }): ParseOutcome<VlrEvent> {
  const document = parseHtmlDocument(html);
  const errors: ParseIssue[] = [];
  const warnings: ParseIssue[] = [];

  const root = document.querySelector(".event-header");
  if (!root) {
    errors.push({ code: "critical_field_missing", message: "No .event-header root element found.", selector: ".event-header" });
    return { value: null, warnings, errors, parserVersion: PARSER_VERSION };
  }

  let vlrEventId = extractIdFromUrl(source.sourceUrl, EVENT_ID_FROM_URL);
  if (!vlrEventId) {
    vlrEventId = extractAttribute(root, "data-event-id");
    if (vlrEventId) warnings.push({ code: "parser_fallback_used", message: "Event ID recovered from data-event-id fallback, not the URL." });
  }
  if (!vlrEventId) {
    errors.push({ code: "critical_field_missing", message: "Could not determine the event's VLR ID from the URL or a fallback attribute." });
  }

  const name = extractText(root.querySelector(".event-header-main-title"));
  if (!name) errors.push({ code: "critical_field_missing", message: "Event name is required but missing.", selector: ".event-header-main-title" });

  const statusRaw = source.statusHint;
  const status = statusRaw && VALID_STATUSES.includes(statusRaw) ? statusRaw : undefined;
  if (!status) {
    errors.push({
      code: "critical_field_missing",
      message: `Event status "${statusRaw ?? "(missing)"}" is not a recognized status. Real event-detail pages carry no status text; it must be supplied from the discovery listing.`,
      selector: ".event-header-main-title",
    });
  }

  if (errors.length > 0) {
    return { value: null, warnings, errors, parserVersion: PARSER_VERSION };
  }

  const breadcrumbTags = Array.from(root.querySelectorAll(".event-header-main-bc-tags > a"));
  const parentSeries = extractText(root.querySelector(".event-header-main-bc > a"));
  const stageTag = breadcrumbTags.find((tag) => STAGE_QUERY_PATTERN.test(extractAttribute(tag, "href") ?? ""));
  const regionTags = breadcrumbTags.filter((tag) => REGION_QUERY_PATTERN.test(extractAttribute(tag, "href") ?? ""));
  const stage = extractText(stageTag);
  const region = regionTags.length === 1 ? extractText(regionTags[0])?.toLowerCase() : undefined;
  if (regionTags.length > 1) {
    warnings.push({ code: "partial_record", message: `Event has ${regionTags.length} region tags (international event); leaving region unset rather than guessing one.` });
  }

  const seasonMatch = parentSeries ? /(\d{4})/.exec(parentSeries) : null;
  const season = seasonMatch?.[1];

  const datesRaw = findMetaValue(root, "Dates");
  const { startDateIso, endDateIso } = parseEventDateRangeText(datesRaw);
  if (datesRaw && (!startDateIso || !endDateIso)) {
    warnings.push({ code: "ambiguous_timezone", message: "Event dates were present but not in a recognized year-bearing range form; left unnormalized." });
  }

  const rawCategoryLabels = querySelectorAllText(root, ".event-header-main-bc-tags > a");

  // The "Matches (N)" nav tab lives outside .event-header (a sibling .wf-nav
  // block), so this searches the whole document. It's the only authoritative
  // expected-match-count signal VLR exposes — see TASK-042 requirement 2
  // ("match-list pagination"): live verification found the match-list page
  // itself has no pagination of its own, so this count is what match
  // discovery verifies its results against instead.
  const matchesNavItem = document.querySelector('a.wf-nav-item[href*="/event/matches/"]');
  const matchesNavText = extractText(matchesNavItem);
  const matchCountMatch = matchesNavText ? /\((\d+)\)/.exec(matchesNavText) : null;
  const listedMatchCount = matchCountMatch ? Number.parseInt(matchCountMatch[1]!, 10) : undefined;

  const sourceMetadata: RawSourceMetadata = { sourceUrl: source.sourceUrl, fetchedAt: source.fetchedAt, parserVersion: PARSER_VERSION };

  const event: VlrEvent = {
    vlrEventId: vlrEventId!,
    name: name!,
    status: status!,
    startDateRaw: datesRaw,
    startDateIso,
    endDateRaw: datesRaw,
    endDateIso,
    region,
    eventUrl: source.sourceUrl,
    season,
    stage,
    parentSeries,
    rawCategoryLabels: rawCategoryLabels.length > 0 ? rawCategoryLabels : undefined,
    listedMatchCount,
    source: sourceMetadata,
  };

  return { value: event, warnings, errors, parserVersion: PARSER_VERSION };
}
