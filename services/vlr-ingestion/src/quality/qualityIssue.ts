/**
 * Data-quality severity framework — TASK-043 requirement 15. This is a
 * richer, dataset-level companion to `normalize/qualityFlags.ts`'s
 * per-record `QualityFlag` (TASK-041/042, kept unchanged — see
 * docs/29-vlr-data-ingestion-foundation.md). `QualityFlag` documents a
 * caveat inline on one normalized record at normalization time;
 * `QualityIssue` is the auditable, dataset-wide ledger entry produced by
 * TASK-043's identity/roster/event/match/score/map/timestamp audits, with a
 * stable code, an entity reference, and a resolution lifecycle. Neither
 * ever deletes the record it describes.
 */

export type QualityIssueSeverity = "info" | "warning" | "error" | "fatal" | "quarantined";

export type QualityIssueEntityType = "team" | "player" | "event" | "match" | "roster";

/** Fixed vocabulary — see TASK-043 requirement 15. Every code maps to exactly one default severity via `DEFAULT_SEVERITY_BY_CODE`. */
export type QualityIssueCode =
  | "unmapped_team"
  | "team_mapping_conflict"
  | "alias_collision"
  | "duplicate_player_handle"
  | "duplicate_player_in_roster"
  | "player_on_both_teams"
  | "incomplete_roster"
  | "impossible_roster_size"
  | "duplicate_match_id"
  | "semantic_duplicate_candidate"
  | "event_family_conflict"
  | "stale_event_record"
  | "stale_match_record"
  | "unknown_map"
  | "unplayed_map_placeholder"
  | "inconsistent_series_winner"
  | "inconsistent_map_winner"
  | "invalid_score"
  | "outside_date_scope"
  | "missing_timestamp"
  | "ambiguous_timestamp"
  | "forfeit"
  | "source_identity_missing";

export type QualityIssueResolutionStatus = "open" | "resolved";

export interface QualityIssue {
  readonly code: QualityIssueCode;
  readonly severity: QualityIssueSeverity;
  readonly entityType: QualityIssueEntityType;
  readonly entityId: string;
  readonly field?: string;
  /** Human-readable, safe message — never raw HTML, never a secret. */
  readonly message: string;
  readonly sourceReference?: string;
  readonly firstDetectedAt: string;
  readonly latestDetectedAt: string;
  readonly resolutionStatus: QualityIssueResolutionStatus;
  readonly resolutionEvidence?: string;
}

const DEFAULT_SEVERITY_BY_CODE: Record<QualityIssueCode, QualityIssueSeverity> = {
  unmapped_team: "info",
  team_mapping_conflict: "fatal",
  alias_collision: "warning",
  duplicate_player_handle: "warning",
  duplicate_player_in_roster: "error",
  player_on_both_teams: "error",
  incomplete_roster: "warning",
  impossible_roster_size: "error",
  duplicate_match_id: "fatal",
  semantic_duplicate_candidate: "warning",
  event_family_conflict: "error",
  stale_event_record: "warning",
  stale_match_record: "warning",
  unknown_map: "warning",
  unplayed_map_placeholder: "info",
  inconsistent_series_winner: "fatal",
  inconsistent_map_winner: "error",
  invalid_score: "fatal",
  outside_date_scope: "warning",
  missing_timestamp: "warning",
  ambiguous_timestamp: "warning",
  forfeit: "warning",
  source_identity_missing: "fatal",
};

export function defaultSeverityForCode(code: QualityIssueCode): QualityIssueSeverity {
  return DEFAULT_SEVERITY_BY_CODE[code];
}

export interface CreateQualityIssueInput {
  readonly code: QualityIssueCode;
  readonly entityType: QualityIssueEntityType;
  readonly entityId: string;
  readonly message: string;
  readonly field?: string;
  readonly sourceReference?: string;
  readonly severity?: QualityIssueSeverity;
  readonly detectedAt: string;
}

export function createQualityIssue(input: CreateQualityIssueInput): QualityIssue {
  return {
    code: input.code,
    severity: input.severity ?? defaultSeverityForCode(input.code),
    entityType: input.entityType,
    entityId: input.entityId,
    field: input.field,
    message: input.message,
    sourceReference: input.sourceReference,
    firstDetectedAt: input.detectedAt,
    latestDetectedAt: input.detectedAt,
    resolutionStatus: "open",
  };
}

function issueKey(issue: Pick<QualityIssue, "code" | "entityType" | "entityId" | "field">): string {
  return `${issue.code}::${issue.entityType}::${issue.entityId}::${issue.field ?? ""}`;
}

/**
 * Merges a freshly-computed issue list against a previously-persisted
 * ledger: a recurring issue (same code/entity/field) keeps its original
 * `firstDetectedAt` and advances `latestDetectedAt`; an issue no longer
 * reproduced is dropped from the *open* set but never fabricated back in —
 * callers that need historical issues should read the prior ledger
 * directly rather than relying on this merge to retain them.
 */
export function mergeQualityIssues(previous: readonly QualityIssue[], current: readonly QualityIssue[]): QualityIssue[] {
  const previousByKey = new Map(previous.map((issue) => [issueKey(issue), issue]));
  return current.map((issue) => {
    const existing = previousByKey.get(issueKey(issue));
    return existing ? { ...issue, firstDetectedAt: existing.firstDetectedAt } : issue;
  });
}

const SEVERITY_ORDER: Record<QualityIssueSeverity, number> = { quarantined: 0, fatal: 1, error: 2, warning: 3, info: 4 };

/** Deterministic ordering: severity (most severe first), then code, then entity ID, then field — never insertion order. */
export function sortQualityIssues(issues: readonly QualityIssue[]): QualityIssue[] {
  return [...issues].sort((a, b) => {
    if (SEVERITY_ORDER[a.severity] !== SEVERITY_ORDER[b.severity]) return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (a.code !== b.code) return a.code.localeCompare(b.code);
    if (a.entityId !== b.entityId) return a.entityId.localeCompare(b.entityId);
    return (a.field ?? "").localeCompare(b.field ?? "");
  });
}

export interface QualityIssueSummary {
  readonly totalIssues: number;
  readonly bySeverity: Record<QualityIssueSeverity, number>;
  readonly byCode: Partial<Record<QualityIssueCode, number>>;
  readonly openCount: number;
  readonly resolvedCount: number;
}

export function summarizeQualityIssues(issues: readonly QualityIssue[]): QualityIssueSummary {
  const bySeverity: Record<QualityIssueSeverity, number> = { info: 0, warning: 0, error: 0, fatal: 0, quarantined: 0 };
  const byCode: Partial<Record<QualityIssueCode, number>> = {};
  let openCount = 0;
  let resolvedCount = 0;
  for (const issue of issues) {
    bySeverity[issue.severity] += 1;
    byCode[issue.code] = (byCode[issue.code] ?? 0) + 1;
    if (issue.resolutionStatus === "resolved") resolvedCount += 1;
    else openCount += 1;
  }
  return { totalIssues: issues.length, bySeverity, byCode, openCount, resolvedCount };
}
