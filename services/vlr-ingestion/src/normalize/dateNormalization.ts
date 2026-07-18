/**
 * Date/timezone normalization — see docs/29-vlr-data-ingestion-foundation.md
 * ("Date and Timezone Normalization") and TASK-041 requirement 16.
 *
 * VLR's displayed match/event times are rendered client-side in the
 * viewer's local timezone; a raw text capture of that display alone is
 * fundamentally ambiguous. This module normalizes to UTC only when a
 * genuinely unambiguous source is present (a full ISO 8601 timestamp with
 * an explicit offset/`Z`, e.g. a `data-scheduled`/`data-utc-ts` attribute).
 * A bare display string alone is never promoted to a normalized timestamp —
 * see requirement 16: "If exact timezone cannot be derived: keep the raw
 * string... do not fabricate UTC."
 */
export type DateConfidence = "high" | "none";

export interface NormalizedTimestamp {
  readonly iso: string | null;
  readonly raw: string | undefined;
  readonly confidence: DateConfidence;
}

const OFFSET_OR_ZULU_PATTERN = /(Z|[+-]\d{2}:?\d{2})$/;

/**
 * `structured` must already look like an unambiguous ISO 8601 timestamp
 * (trailing `Z` or numeric offset) to be trusted — this function never
 * guesses the local machine's timezone, per requirement 16.
 */
export function normalizeTimestamp(raw: string | undefined, structured: string | undefined): NormalizedTimestamp {
  if (structured && OFFSET_OR_ZULU_PATTERN.test(structured)) {
    const parsed = Date.parse(structured);
    if (!Number.isNaN(parsed)) {
      return { iso: new Date(parsed).toISOString(), raw: raw ?? structured, confidence: "high" };
    }
  }
  return { iso: null, raw, confidence: "none" };
}

/** True only when `iso` falls within [startDate, endDate] inclusive (both "YYYY-MM-DD"), evaluated in UTC. */
export function isWithinDateScope(iso: string, startDate: string, endDate: string): boolean {
  const timestamp = Date.parse(iso);
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T23:59:59.999Z`);
  return timestamp >= start && timestamp <= end;
}

const EPOCH_SECONDS_PATTERN = /^\d+$/;
const SPACE_SEPARATED_UTC_PATTERN = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/;

/**
 * Converts VLR's `data-utc-ts` attribute — observed in two real forms: a
 * bare epoch-seconds integer (event bracket pages) and a space-separated
 * `"YYYY-MM-DD HH:MM:SS"` string (match header) — into an unambiguous ISO
 * 8601 UTC timestamp. The attribute name itself is the source's assertion
 * that the value is UTC (TASK-042 live-markup verification), so both forms
 * are trusted directly rather than re-derived from any displayed text.
 * Returns `undefined` for anything that doesn't match a known form, never a
 * guessed value.
 */
export function parseUtcTsAttribute(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();

  if (EPOCH_SECONDS_PATTERN.test(trimmed)) {
    const seconds = Number(trimmed);
    if (!Number.isSafeInteger(seconds) || seconds <= 0) return undefined;
    return new Date(seconds * 1000).toISOString();
  }

  const match = SPACE_SEPARATED_UTC_PATTERN.exec(trimmed);
  if (match) {
    const iso = `${match[1]}T${match[2]}.000Z`;
    return Number.isNaN(Date.parse(iso)) ? undefined : iso;
  }

  return undefined;
}

const MONTH_LOOKUP: ReadonlyMap<string, number> = new Map(
  ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].map((abbr, index) => [abbr, index]),
);

/**
 * Parses VLR's free-text event date range (e.g. `"Sep 24 – Oct 18, 2026"` or
 * `"Jun 6–21, 2026"`, both observed on live event pages using an en dash)
 * into ISO date-only UTC timestamps. Requires an explicit trailing year —
 * the discovery-listing form (`"Jul 17—Sep 7"`, no year, em dash) never
 * matches and correctly returns `undefined` rather than guessing a year.
 */
export function parseEventDateRangeText(text: string | undefined): { startDateIso?: string; endDateIso?: string } {
  if (!text) return {};
  const trimmed = text.trim();

  const yearMatch = /,\s*(\d{4})\s*$/.exec(trimmed);
  if (!yearMatch) return {};
  const year = yearMatch[1];
  const withoutYear = trimmed.slice(0, yearMatch.index).trim();

  const parts = withoutYear.split(/[–—-]/).map((part) => part.trim());
  if (parts.length !== 2) return {};

  const startMatch = /^([A-Za-z]{3,})\s+(\d{1,2})$/.exec(parts[0]);
  if (!startMatch) return {};
  const startMonthAbbr = startMatch[1].slice(0, 3).toLowerCase();
  const startMonth = MONTH_LOOKUP.get(startMonthAbbr);
  if (startMonth === undefined) return {};
  const startDay = Number(startMatch[2]);

  const endWithMonth = /^([A-Za-z]{3,})\s+(\d{1,2})$/.exec(parts[1]);
  const endDayOnly = /^(\d{1,2})$/.exec(parts[1]);
  let endMonth: number | undefined;
  let endDay: number | undefined;
  if (endWithMonth) {
    const abbr = endWithMonth[1].slice(0, 3).toLowerCase();
    endMonth = MONTH_LOOKUP.get(abbr);
    endDay = Number(endWithMonth[2]);
  } else if (endDayOnly) {
    endMonth = startMonth;
    endDay = Number(endDayOnly[1]);
  }
  if (endMonth === undefined || endDay === undefined) return {};

  const startDateIso = buildIsoDate(year, startMonth, startDay);
  const endDateIso = buildIsoDate(year, endMonth, endDay);
  if (!startDateIso || !endDateIso) return {};
  return { startDateIso, endDateIso };
}

function buildIsoDate(year: string, monthIndex: number, day: number): string | undefined {
  const iso = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00.000Z`;
  return Number.isNaN(Date.parse(iso)) ? undefined : iso;
}
