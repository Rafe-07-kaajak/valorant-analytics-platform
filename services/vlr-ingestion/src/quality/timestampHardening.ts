import { isWithinDateScope } from "../normalize/dateNormalization";
import type { NormalizedEvent, NormalizedMatch } from "../normalize/normalizedSchemas";
import { createQualityIssue } from "./qualityIssue";
import type { QualityIssue } from "./qualityIssue";

/**
 * Timestamp hardening — TASK-043 requirement 14. Reuses
 * `normalize/dateNormalization.ts` (unchanged: provider UTC attributes are
 * the only source ever trusted, ambiguous text stays `raw`/`confidence:
 * "none"`). This module adds the dataset-level cross-checks a single
 * record's own normalization can't do alone: a match's timestamp against
 * its *parent event's* date range, and against the approved scope window.
 */
export function auditMatchTimestamp(match: NormalizedMatch, event: NormalizedEvent | null, scopeStartDate: string, scopeEndDate: string, detectedAt: string): readonly QualityIssue[] {
  const issues: QualityIssue[] = [];
  const sourceReference = match.sourceReference.sourceUrl;

  if (!match.scheduledAt.iso) {
    issues.push(
      createQualityIssue({
        code: match.scheduledAt.raw ? "ambiguous_timestamp" : "missing_timestamp",
        entityType: "match",
        entityId: match.internalId,
        field: "scheduledAt",
        message: match.scheduledAt.raw
          ? `Match timestamp could not be normalized with confidence from raw text "${match.scheduledAt.raw}".`
          : "Match has no scheduled/played timestamp at all.",
        sourceReference,
        detectedAt,
      }),
    );
    return issues; // nothing further to cross-check without a normalized timestamp.
  }

  if (!isWithinDateScope(match.scheduledAt.iso, scopeStartDate, scopeEndDate)) {
    issues.push(
      createQualityIssue({
        code: "outside_date_scope",
        entityType: "match",
        entityId: match.internalId,
        field: "scheduledAt",
        message: `Match is scheduled at ${match.scheduledAt.iso}, outside the approved dataset scope [${scopeStartDate}, ${scopeEndDate}].`,
        sourceReference,
        detectedAt,
      }),
    );
  }

  if (event?.startDate.iso && event.endDate.iso) {
    const eventStart = event.startDate.iso;
    const eventEnd = `${event.endDate.iso.slice(0, 10)}T23:59:59.999Z`; // event end dates are date-only — extend to end-of-day for a fair comparison.
    if (match.scheduledAt.iso < eventStart || match.scheduledAt.iso > eventEnd) {
      issues.push(
        createQualityIssue({
          code: "outside_date_scope",
          entityType: "match",
          entityId: match.internalId,
          field: "scheduledAt",
          message: `Match is scheduled at ${match.scheduledAt.iso}, outside its parent event's own date range [${eventStart}, ${eventEnd}].`,
          sourceReference,
          detectedAt,
          severity: "warning",
        }),
      );
    }
  }

  return issues;
}
