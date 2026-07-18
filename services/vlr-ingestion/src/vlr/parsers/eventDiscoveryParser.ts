import { extractAttribute, extractIdFromUrl, extractText, parseHtmlDocument, PARSER_VERSION } from "./htmlUtils";
import type { ParseIssue, ParseOutcome } from "./htmlUtils";

/**
 * Event discovery/listing page parser — see
 * docs/29-vlr-data-ingestion-foundation.md ("Automatic Match Discovery")
 * and TASK-041 requirement 14. This is the page shape the ingestion
 * coordinator paginates through to discover event IDs automatically;
 * nothing about the backfill ever relies on a manually maintained list of
 * event IDs.
 */

export interface VlrEventDiscoveryEntry {
  readonly vlrEventId: string;
  readonly name: string;
  readonly eventUrl: string;
  readonly statusRaw?: string;
  readonly startDateRaw?: string;
}

const EVENT_ID_FROM_HREF = /\/event\/(\d+)/;

export function parseEventDiscoveryPage(html: string, source: { sourceUrl: string }): ParseOutcome<readonly VlrEventDiscoveryEntry[]> {
  const document = parseHtmlDocument(html);
  const errors: ParseIssue[] = [];
  const warnings: ParseIssue[] = [];

  const root = document.querySelector(".event-list");
  if (!root) {
    errors.push({ code: "critical_field_missing", message: "No .event-list root element found.", selector: ".event-list" });
    return { value: null, warnings, errors, parserVersion: PARSER_VERSION };
  }

  const entries: VlrEventDiscoveryEntry[] = [];
  const items = Array.from(root.querySelectorAll(".event-list-item"));

  for (const item of items) {
    const href = extractAttribute(item, "href");
    const vlrEventId = href ? extractIdFromUrl(href, EVENT_ID_FROM_HREF) : undefined;
    const name = extractText(item);

    if (!vlrEventId || !name) {
      warnings.push({ code: "partial_record", message: "Skipped a discovery list item missing an ID or name.", selector: ".event-list-item" });
      continue;
    }

    entries.push({
      vlrEventId,
      name,
      eventUrl: new URL(href!, source.sourceUrl).toString(),
      statusRaw: extractAttribute(item, "data-status"),
      startDateRaw: extractAttribute(item, "data-start"),
    });
  }

  if (items.length > 0 && entries.length === 0) {
    warnings.push({ code: "source_markup_changed", message: "Every discovery list item failed to parse; the page structure may have changed." });
  }

  return { value: entries, warnings, errors, parserVersion: PARSER_VERSION };
}
