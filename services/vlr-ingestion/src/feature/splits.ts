import type { CanonicalWindow } from "./canonicalWindow";
import { isEligibleForCanonicalWindow } from "./canonicalWindow";
import type { FeatureRow } from "./types";

/**
 * Temporal split and walk-forward fold metadata — TASK-044 requirement 17.
 * Rows are assumed to already be in stable chronological order (the state
 * engine's own output guarantee) — every function here relies on that
 * ordering rather than re-sorting, so it can never accidentally place a
 * later match before an earlier one.
 *
 * `"excluded"` marks a row that falls before the canonical eligibility
 * window (see `canonicalWindow.ts`) — it is never assigned to train/
 * validation/test, but it still gets a real `SplitAssignment` record so
 * every row remains fully traceable rather than silently vanishing from
 * `split-assignments.json`. Feature *computation* (Elo/form state) still
 * replays these rows — only their eligibility for the split is affected.
 */
export type SplitLabel = "train" | "validation" | "test" | "excluded";

const DEFAULT_TRAIN_FRACTION = 0.7;
const DEFAULT_VALIDATION_FRACTION = 0.15;
// Remaining ~0.15 is test.

export interface SplitBoundaries {
  readonly trainRowCount: number;
  readonly validationRowCount: number;
  readonly testRowCount: number;
  readonly trainEndIso: string | null;
  readonly validationEndIso: string | null;
}

export interface SplitAssignment {
  readonly matchInternalId: string;
  readonly scheduledAt: string;
  readonly split: SplitLabel;
}

/** Chronological boundaries chosen from the actual row-count distribution — never a guessed calendar date. */
export function computeSplitBoundaries(rows: readonly FeatureRow[], trainFraction: number = DEFAULT_TRAIN_FRACTION, validationFraction: number = DEFAULT_VALIDATION_FRACTION): SplitBoundaries {
  const n = rows.length;
  const trainRowCount = Math.floor(n * trainFraction);
  const validationRowCount = Math.floor(n * validationFraction);
  const testRowCount = n - trainRowCount - validationRowCount;
  return {
    trainRowCount,
    validationRowCount,
    testRowCount,
    trainEndIso: rows[trainRowCount - 1]?.scheduledAt ?? null,
    validationEndIso: rows[trainRowCount + validationRowCount - 1]?.scheduledAt ?? null,
  };
}

export function assignSplits(rows: readonly FeatureRow[], boundaries: SplitBoundaries): readonly SplitAssignment[] {
  return rows.map((row, index) => {
    const split: SplitLabel = index < boundaries.trainRowCount ? "train" : index < boundaries.trainRowCount + boundaries.validationRowCount ? "validation" : "test";
    return { matchInternalId: row.matchInternalId, scheduledAt: row.scheduledAt, split };
  });
}

export interface SplitDiagnostics {
  readonly rowCount: number;
  readonly byYear: Record<number, number>;
  readonly byEventFamily: Record<string, number>;
  readonly coldStartRate: number;
}

function diagnosticsFor(rows: readonly FeatureRow[]): SplitDiagnostics {
  const byYear: Record<number, number> = {};
  const byEventFamily: Record<string, number> = {};
  let coldStartCount = 0;
  for (const row of rows) {
    byYear[row.seasonYear] = (byYear[row.seasonYear] ?? 0) + 1;
    byEventFamily[row.eventFamily] = (byEventFamily[row.eventFamily] ?? 0) + 1;
    if (row.teamAIsColdStart || row.teamBIsColdStart) coldStartCount += 1;
  }
  return { rowCount: rows.length, byYear, byEventFamily, coldStartRate: rows.length > 0 ? coldStartCount / rows.length : 0 };
}

export interface SplitSummary {
  readonly boundaries: SplitBoundaries;
  readonly train: SplitDiagnostics;
  readonly validation: SplitDiagnostics;
  readonly test: SplitDiagnostics;
}

export function summarizeSplits(rows: readonly FeatureRow[], boundaries: SplitBoundaries): SplitSummary {
  return {
    boundaries,
    train: diagnosticsFor(rows.slice(0, boundaries.trainRowCount)),
    validation: diagnosticsFor(rows.slice(boundaries.trainRowCount, boundaries.trainRowCount + boundaries.validationRowCount)),
    test: diagnosticsFor(rows.slice(boundaries.trainRowCount + boundaries.validationRowCount)),
  };
}

/**
 * Walk-forward (expanding-window) folds for TASK-045 backtesting. The
 * first `warmupFraction` of chronological rows is reserved as a minimum
 * history warm-up period never used as a validation target; each
 * subsequent fold's train set expands to include the previous fold's
 * validation rows, guaranteeing validation always lies strictly after its
 * own train set with no overlap.
 */
export interface WalkForwardFold {
  readonly foldId: number;
  readonly trainRowCount: number;
  readonly validationRowCount: number;
  readonly trainStartIso: string | null;
  readonly trainEndIso: string | null;
  readonly validationStartIso: string | null;
  readonly validationEndIso: string | null;
  readonly trainMatchInternalIds: readonly string[];
  readonly validationMatchInternalIds: readonly string[];
}

const DEFAULT_WARMUP_FRACTION = 0.2;
const DEFAULT_FOLD_COUNT = 5;

export function computeWalkForwardFolds(rows: readonly FeatureRow[], foldCount: number = DEFAULT_FOLD_COUNT, warmupFraction: number = DEFAULT_WARMUP_FRACTION): readonly WalkForwardFold[] {
  if (rows.length === 0) return [];
  const warmupCount = Math.max(1, Math.floor(rows.length * warmupFraction));
  const remaining = rows.length - warmupCount;
  if (remaining <= 0) return [];
  const chunkSize = Math.max(1, Math.floor(remaining / foldCount));

  const folds: WalkForwardFold[] = [];
  let trainEndIdx = warmupCount;
  for (let fold = 0; fold < foldCount && trainEndIdx < rows.length; fold += 1) {
    const validationStartIdx = trainEndIdx;
    const isLastFold = fold === foldCount - 1;
    const validationEndIdx = isLastFold ? rows.length : Math.min(rows.length, trainEndIdx + chunkSize);
    if (validationStartIdx >= validationEndIdx) break;

    const trainRows = rows.slice(0, trainEndIdx);
    const validationRows = rows.slice(validationStartIdx, validationEndIdx);
    folds.push({
      foldId: fold,
      trainRowCount: trainRows.length,
      validationRowCount: validationRows.length,
      trainStartIso: trainRows[0]?.scheduledAt ?? null,
      trainEndIso: trainRows[trainRows.length - 1]?.scheduledAt ?? null,
      validationStartIso: validationRows[0]?.scheduledAt ?? null,
      validationEndIso: validationRows[validationRows.length - 1]?.scheduledAt ?? null,
      trainMatchInternalIds: trainRows.map((r) => r.matchInternalId),
      validationMatchInternalIds: validationRows.map((r) => r.matchInternalId),
    });
    trainEndIdx = validationEndIdx;
  }
  return folds;
}

export interface WindowPartition {
  /** Chronologically ordered subsequence at-or-after the canonical window start — the only rows eligible for train/validation/test. */
  readonly eligible: readonly FeatureRow[];
  /** Chronologically ordered subsequence strictly before the canonical window start. */
  readonly excluded: readonly FeatureRow[];
}

/** Splits already-chronologically-ordered rows into the canonical-window-eligible subsequence and the excluded (pre-window) subsequence, preserving relative order in both. */
export function partitionEligibleForSplitting(rows: readonly FeatureRow[], window: CanonicalWindow): WindowPartition {
  const eligible: FeatureRow[] = [];
  const excluded: FeatureRow[] = [];
  for (const row of rows) {
    if (isEligibleForCanonicalWindow(row.scheduledAt, window)) eligible.push(row);
    else excluded.push(row);
  }
  return { eligible, excluded };
}

/** Assigns every excluded (pre-window) row its own traceable `"excluded"` split record. */
export function assignExcludedSplits(excludedRows: readonly FeatureRow[]): readonly SplitAssignment[] {
  return excludedRows.map((row) => ({ matchInternalId: row.matchInternalId, scheduledAt: row.scheduledAt, split: "excluded" }));
}
