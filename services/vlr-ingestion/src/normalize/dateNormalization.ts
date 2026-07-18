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
