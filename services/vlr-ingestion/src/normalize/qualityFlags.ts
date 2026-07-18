/**
 * Data-quality flag vocabulary — see docs/29-vlr-data-ingestion-foundation.md
 * ("Data-Quality Framework") and TASK-041 requirement 18. Every normalized
 * record carries zero or more of these; a flag never deletes a record, it
 * only documents why the record should be treated with caution (or
 * excluded from training) downstream.
 */
export type DataQualityCode =
  | "missing_team_mapping"
  | "missing_timestamp"
  | "ambiguous_timezone"
  | "missing_series_format"
  | "missing_map_score"
  | "unknown_map"
  | "incomplete_roster"
  | "inconsistent_winner"
  | "parser_fallback_used"
  | "source_markup_changed"
  | "partial_record"
  | "unknown_event_classification"
  | "low_confidence_event_classification"
  | "excluded_event_category"
  | "outside_date_scope"
  | "duplicate_match"
  | "not_completed"
  | "not_training_eligible";

export type QualitySeverity = "info" | "warning" | "critical";

export interface QualityFlag {
  readonly code: DataQualityCode;
  readonly severity: QualitySeverity;
  readonly message: string;
  readonly field?: string;
  readonly sourceReference?: string;
}

const CRITICAL_CODES: ReadonlySet<DataQualityCode> = new Set(["unknown_event_classification", "excluded_event_category", "not_training_eligible"]);

export function qualityFlag(code: DataQualityCode, message: string, options?: { field?: string; sourceReference?: string }): QualityFlag {
  return { code, severity: CRITICAL_CODES.has(code) ? "critical" : "warning", message, field: options?.field, sourceReference: options?.sourceReference };
}
