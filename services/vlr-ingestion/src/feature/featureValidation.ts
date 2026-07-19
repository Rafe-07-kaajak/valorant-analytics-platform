import type { NormalizedMatch } from "../normalize/normalizedSchemas";
import type { FeatureRow } from "./types";
import { buildMatchLabels } from "./labels";
import { featureCatalogFieldNames } from "./featureCatalog";
import type { SplitAssignment } from "./splits";

/**
 * Feature validation framework — TASK-044 requirement 19. Fatal problems
 * (`errors`) are things that must never occur in a correct build (leakage,
 * corrupt values, schema drift); `warnings` flag benign, expected
 * conditions worth surfacing (e.g. a normal cold-start rate). The CLI gate
 * (`cli/featuresValidate.ts`) exits non-zero only on `errors`.
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly statistics: Record<string, number>;
}

const RATE_FIELD_SUFFIXES = ["WinRate", "WinProbability", "ContinuityVsPreviousMatch", "ContinuityLast3Matches", "MapExperienceEntropy", "TopMapConcentration", "SideWinRate"];

/**
 * Every numeric field is required to be non-negative *except* the small,
 * explicitly-named set of genuinely signed differential/diagnostic fields
 * below — an allowlist of exceptions is far less error-prone here than
 * trying to pattern-match every non-negative field name as the schema
 * grows.
 */
const SIGNED_FIELD_NAMES = new Set(["restDifferenceDays", "eloRatingDiff", "mapStrengthDifferential", "h2hPriorMapDifferential"]);
const SIGNED_FIELD_SUFFIXES = ["FormTrend"];

function isRateField(key: string): boolean {
  return RATE_FIELD_SUFFIXES.some((suffix) => key.endsWith(suffix));
}

function isSignedField(key: string): boolean {
  // Elo ratings are mathematically unbounded below (though practically
  // never negative at this dataset's scale) — never treated as a
  // data-quality violation if they were.
  return SIGNED_FIELD_NAMES.has(key) || SIGNED_FIELD_SUFFIXES.some((suffix) => key.endsWith(suffix)) || key.includes("Elo");
}

/**
 * Independently recomputes each row's `teamXPriorMatchCount` directly from
 * the source matches, using only matches with a strictly earlier timestamp
 * than the row's own `scheduledAt` — the same "strictly before" rule the
 * state engine itself enforces, computed here via an entirely separate code
 * path. A mismatch means either the current match's own result leaked into
 * its row, or a same-timestamp match leaked into another.
 */
function crossCheckPriorMatchCounts(rows: readonly FeatureRow[], matches: readonly NormalizedMatch[]): readonly string[] {
  const errors: string[] = [];
  const byTeam = new Map<string, { timestampMs: number }[]>();
  for (const match of matches) {
    if (match.scheduledAt.iso === null) continue;
    const timestampMs = Date.parse(match.scheduledAt.iso);
    for (const teamId of [match.teamAId, match.teamBId]) {
      const list = byTeam.get(teamId) ?? [];
      list.push({ timestampMs });
      byTeam.set(teamId, list);
    }
  }

  for (const row of rows) {
    const rowMs = Date.parse(row.scheduledAt);
    const expectedA = (byTeam.get(row.teamAProviderId) ?? []).filter((m) => m.timestampMs < rowMs).length;
    const expectedB = (byTeam.get(row.teamBProviderId) ?? []).filter((m) => m.timestampMs < rowMs).length;
    if (row.teamAPriorMatchCount !== expectedA) {
      errors.push(`Leakage check failed for ${row.matchInternalId}: teamAPriorMatchCount is ${row.teamAPriorMatchCount}, independently recomputed as ${expectedA}.`);
    }
    if (row.teamBPriorMatchCount !== expectedB) {
      errors.push(`Leakage check failed for ${row.matchInternalId}: teamBPriorMatchCount is ${row.teamBPriorMatchCount}, independently recomputed as ${expectedB}.`);
    }
  }
  return errors;
}

export function validateFeatureRows(rows: readonly FeatureRow[], sourceMatches: readonly NormalizedMatch[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sourceMatchIds = new Set(sourceMatches.map((m) => m.internalId));
  const matchesById = new Map(sourceMatches.map((m) => [m.internalId, m]));

  // Duplicate rows.
  const seenIds = new Set<string>();
  for (const row of rows) {
    if (seenIds.has(row.matchInternalId)) errors.push(`Duplicate feature row for match ${row.matchInternalId}.`);
    seenIds.add(row.matchInternalId);
  }

  // Chronological output.
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i]!.scheduledAt < rows[i - 1]!.scheduledAt) {
      errors.push(`Non-chronological output: row ${i} (${rows[i]!.matchInternalId}) is scheduled before row ${i - 1} (${rows[i - 1]!.matchInternalId}).`);
    }
  }

  // Feature catalog mismatch.
  const catalogNames = new Set(featureCatalogFieldNames());
  if (rows.length > 0) {
    const rowKeys = Object.keys(rows[0]!);
    for (const key of rowKeys) if (!catalogNames.has(key)) errors.push(`Feature catalog is missing an entry for column "${key}".`);
    for (const name of catalogNames) if (!rowKeys.includes(name)) errors.push(`Feature catalog declares "${name}", which no row actually has.`);
  }

  let nanOrInfiniteCount = 0;
  let negativeCountViolations = 0;
  let invalidRateViolations = 0;
  let missingIdentifierViolations = 0;
  let labelMismatchCount = 0;
  let outsideCuratedSetCount = 0;

  for (const row of rows) {
    if (!sourceMatchIds.has(row.matchInternalId)) {
      errors.push(`Row ${row.matchInternalId} does not correspond to any match in the curated set.`);
      outsideCuratedSetCount += 1;
    }

    for (const field of ["matchInternalId", "providerMatchId", "teamAProviderId", "teamBProviderId", "eventInternalId"] as const) {
      if (!row[field] || row[field].trim().length === 0) {
        errors.push(`Row ${row.matchInternalId} has a missing/empty identifier field "${field}".`);
        missingIdentifierViolations += 1;
      }
    }

    for (const [key, value] of Object.entries(row)) {
      if (typeof value !== "number") continue;
      if (Number.isNaN(value) || !Number.isFinite(value)) {
        errors.push(`Row ${row.matchInternalId} has a non-finite value for "${key}": ${value}.`);
        nanOrInfiniteCount += 1;
        continue;
      }
      if (isRateField(key) && (value < 0 || value > 1)) {
        errors.push(`Row ${row.matchInternalId} has an out-of-bounds rate/probability value for "${key}": ${value}.`);
        invalidRateViolations += 1;
      }
      if (!isSignedField(key) && value < 0) {
        errors.push(`Row ${row.matchInternalId} has a negative value for "${key}": ${value}.`);
        negativeCountViolations += 1;
      }
    }

    const sourceMatch = matchesById.get(row.matchInternalId);
    if (sourceMatch) {
      const recomputed = buildMatchLabels(sourceMatch);
      if (recomputed.valid && recomputed.labels) {
        if (recomputed.labels.labelTeamAWin !== row.labelTeamAWin || recomputed.labels.labelWinnerProviderId !== row.labelWinnerProviderId) {
          errors.push(`Label mismatch for row ${row.matchInternalId}: row has labelTeamAWin=${row.labelTeamAWin}, recomputed=${recomputed.labels.labelTeamAWin}.`);
          labelMismatchCount += 1;
        }
      }
    }

    if (row.labelTeamAWin !== 0 && row.labelTeamAWin !== 1) {
      errors.push(`Row ${row.matchInternalId} has a non-binary labelTeamAWin: ${row.labelTeamAWin}.`);
    }
  }

  const leakageErrors = crossCheckPriorMatchCounts(rows, sourceMatches);
  errors.push(...leakageErrors);

  const coldStartRowCount = rows.filter((r) => r.teamAIsColdStart || r.teamBIsColdStart).length;
  if (rows.length > 0 && coldStartRowCount / rows.length > 0.5) {
    warnings.push(`Cold-start rate is unusually high (${((coldStartRowCount / rows.length) * 100).toFixed(1)}%).`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    statistics: {
      rowCount: rows.length,
      nanOrInfiniteCount,
      negativeCountViolations,
      invalidRateViolations,
      missingIdentifierViolations,
      labelMismatchCount,
      outsideCuratedSetCount,
      leakageCheckFailures: leakageErrors.length,
      coldStartRowCount,
    },
  };
}

/** Validates a train/validation/test split assignment for overlap and completeness — TASK-044 requirement 19. */
export function validateSplitAssignments(rows: readonly FeatureRow[], assignments: readonly SplitAssignment[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const assignmentByMatch = new Map(assignments.map((a) => [a.matchInternalId, a]));
  let missingFoldAssignments = 0;
  for (const row of rows) {
    if (!assignmentByMatch.has(row.matchInternalId)) {
      errors.push(`Row ${row.matchInternalId} has no split assignment.`);
      missingFoldAssignments += 1;
    }
  }

  const seen = new Set<string>();
  let duplicateAssignments = 0;
  for (const assignment of assignments) {
    if (seen.has(assignment.matchInternalId)) {
      errors.push(`Match ${assignment.matchInternalId} appears in multiple split assignments.`);
      duplicateAssignments += 1;
    }
    seen.add(assignment.matchInternalId);
  }

  const trainMax = Math.max(0, ...assignments.filter((a) => a.split === "train").map((a) => Date.parse(a.scheduledAt)));
  const validationMin = Math.min(Number.POSITIVE_INFINITY, ...assignments.filter((a) => a.split === "validation").map((a) => Date.parse(a.scheduledAt)));
  const validationMax = Math.max(0, ...assignments.filter((a) => a.split === "validation").map((a) => Date.parse(a.scheduledAt)));
  const testMin = Math.min(Number.POSITIVE_INFINITY, ...assignments.filter((a) => a.split === "test").map((a) => Date.parse(a.scheduledAt)));

  if (Number.isFinite(validationMin) && validationMin < trainMax) {
    errors.push("A validation-split match is scheduled before the latest train-split match.");
  }
  if (Number.isFinite(testMin) && Number.isFinite(validationMax) && testMin < validationMax) {
    errors.push("A test-split match is scheduled before the latest validation-split match.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    statistics: { missingFoldAssignments, duplicateAssignments, assignmentCount: assignments.length },
  };
}
