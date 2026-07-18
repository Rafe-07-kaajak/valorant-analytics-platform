import { extractAttribute, extractIdFromUrl, extractText, parseHtmlDocument, PARSER_VERSION } from "./htmlUtils";
import type { ParseIssue, ParseOutcome } from "./htmlUtils";

/**
 * Event discovery/listing page parser — see
 * docs/29-vlr-data-ingestion-foundation.md ("Automatic Match Discovery"),
 * TASK-041 requirement 14, and TASK-042's live-markup verification
 * (`docs/30-vlr-historical-backfill.md`). This is the page shape the
 * ingestion coordinator paginates through to discover event IDs
 * automatically; nothing about the backfill ever relies on a manually
 * maintained list of event IDs.
 *
 * Real `/events?page=N` markup (verified live) has no single "list" root
 * wrapper and no `data-status`/`data-start` attributes: each event is an
 * `a.event-item` card grouped under a `.wf-label` section heading, with
 * status as visible text (`.event-item-desc-item-status`) and a date range
 * as free display text with no year (`.event-item-desc-item.mod-dates`) —
 * genuinely ambiguous at this stage, so `startDateRaw` is preserved verbatim
 * and never promoted to an ISO value here. `parseEventPage` (the per-event
 * detail fetch) is the authoritative source for a year-bearing date range.
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

  const root = document.querySelector(".events-container");
  if (!root) {
    errors.push({ code: "critical_field_missing", message: "No .events-container root element found.", selector: ".events-container" });
    return { value: null, warnings, errors, parserVersion: PARSER_VERSION };
  }

  const entries: VlrEventDiscoveryEntry[] = [];
  const items = Array.from(root.querySelectorAll("a.event-item"));

  for (const item of items) {
    const href = extractAttribute(item, "href");
    const vlrEventId = href ? extractIdFromUrl(href, EVENT_ID_FROM_HREF) : undefined;
    const name = extractText(item.querySelector(".event-item-title"));

    if (!vlrEventId || !name) {
      warnings.push({ code: "partial_record", message: "Skipped a discovery list item missing an ID or name.", selector: "a.event-item" });
      continue;
    }

    entries.push({
      vlrEventId,
      name,
      eventUrl: new URL(href!, source.sourceUrl).toString(),
      statusRaw: extractText(item.querySelector(".event-item-desc-item-status"))?.toLowerCase(),
      startDateRaw: extractText(item.querySelector(".event-item-desc-item.mod-dates")),
    });
  }

  if (items.length > 0 && entries.length === 0) {
    warnings.push({ code: "source_markup_changed", message: "Every discovery list item failed to parse; the page structure may have changed." });
  }

  return { value: entries, warnings, errors, parserVersion: PARSER_VERSION };
}
