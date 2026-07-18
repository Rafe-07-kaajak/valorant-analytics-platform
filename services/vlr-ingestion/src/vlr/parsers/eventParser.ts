import type { RawSourceMetadata, VlrEvent, VlrEventStatus } from "../schemas/raw";
import { extractAttribute, extractIdFromUrl, extractText, parseHtmlDocument, PARSER_VERSION, querySelectorAllText } from "./htmlUtils";
import type { ParseIssue, ParseOutcome } from "./htmlUtils";

/**
 * Event page parser — see docs/29-vlr-data-ingestion-foundation.md
 * ("Parsing") and TASK-041 requirement 14/15. Produces the raw
 * `VlrEvent` record only; family/tier classification is a separate,
 * later stage (`classification/eventClassification.ts`) that consumes this
 * output rather than guessing inline.
 */

const EVENT_ID_FROM_URL = /\/event\/(\d+)/;
const VALID_STATUSES: readonly VlrEventStatus[] = ["upcoming", "ongoing", "completed"];
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeStructuredDate(raw: string | undefined): string | undefined {
  if (!raw || !ISO_DATE_PATTERN.test(raw)) return undefined;
  return `${raw}T00:00:00.000Z`;
}

export function parseEventPage(html: string, source: { sourceUrl: string; fetchedAt: string }): ParseOutcome<VlrEvent> {
  const document = parseHtmlDocument(html);
  const errors: ParseIssue[] = [];
  const warnings: ParseIssue[] = [];

  const root = document.querySelector(".event-page");
  if (!root) {
    errors.push({ code: "critical_field_missing", message: "No .event-page root element found.", selector: ".event-page" });
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

  const name = extractText(root.querySelector(".event-header-name"));
  if (!name) errors.push({ code: "critical_field_missing", message: "Event name is required but missing.", selector: ".event-header-name" });

  const statusRaw = extractText(root.querySelector(".event-header-status"))?.toLowerCase();
  const status = VALID_STATUSES.find((candidate) => candidate === statusRaw);
  if (!status) {
    errors.push({ code: "critical_field_missing", message: `Event status "${statusRaw ?? "(missing)"}" is not a recognized status.`, selector: ".event-header-status" });
  }

  if (errors.length > 0) {
    return { value: null, warnings, errors, parserVersion: PARSER_VERSION };
  }

  const datesElement = root.querySelector(".event-header-dates");
  const startDateRaw = extractAttribute(datesElement, "data-start");
  const endDateRaw = extractAttribute(datesElement, "data-end");
  const startDateIso = normalizeStructuredDate(startDateRaw);
  const endDateIso = normalizeStructuredDate(endDateRaw);
  if ((startDateRaw && !startDateIso) || (endDateRaw && !endDateIso)) {
    warnings.push({ code: "ambiguous_timezone", message: "Event dates were present but not in an unambiguous YYYY-MM-DD form; left unnormalized." });
  }

  const region = extractText(root.querySelector(".event-header-region"))?.toLowerCase();
  const parentSeries = extractText(root.querySelector(".event-header-series"));
  const season = extractText(root.querySelector(".event-header-season"));
  const stage = extractText(root.querySelector(".event-header-stage"));
  const rawCategoryLabels = querySelectorAllText(root, ".event-tag");

  const sourceMetadata: RawSourceMetadata = { sourceUrl: source.sourceUrl, fetchedAt: source.fetchedAt, parserVersion: PARSER_VERSION };

  const event: VlrEvent = {
    vlrEventId: vlrEventId!,
    name: name!,
    status: status!,
    startDateRaw: extractText(datesElement) ?? startDateRaw,
    startDateIso,
    endDateRaw,
    endDateIso,
    region,
    eventUrl: source.sourceUrl,
    season,
    stage,
    parentSeries,
    rawCategoryLabels: rawCategoryLabels.length > 0 ? rawCategoryLabels : undefined,
    source: sourceMetadata,
  };

  return { value: event, warnings, errors, parserVersion: PARSER_VERSION };
}
