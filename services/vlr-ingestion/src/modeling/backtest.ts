import type { FeatureRow } from "../feature/types";
import type { WalkForwardFold } from "../feature/splits";
import { buildRowsById, selectRowsByIds } from "./io";
import { computeMetrics, type ProbabilisticMetrics } from "./metrics";
import type { FoldModelFn } from "./candidates";
import { ModelingError } from "./errors";

/**
 * Walk-forward (expanding-window) backtesting — TASK-045 requirement 7B.
 * Reuses TASK-044's precomputed fold boundaries (`walk-forward-folds.json`)
 * verbatim rather than recomputing them, so fold N's validation window is
 * guaranteed — by construction, not by a second check here — to start
 * strictly after fold N's own train window ends. Each fold fits its own
 * preprocessing and model from scratch on that fold's train rows only.
 */

export interface FoldPrediction {
  readonly matchInternalId: string;
  readonly predicted: number;
  readonly actual: number;
}

export interface FoldResult {
  readonly foldId: number;
  readonly trainRowCount: number;
  readonly validationRowCount: number;
  readonly trainStartIso: string | null;
  readonly trainEndIso: string | null;
  readonly validationStartIso: string | null;
  readonly validationEndIso: string | null;
  readonly metrics: ProbabilisticMetrics;
  readonly predictions: readonly FoldPrediction[];
}

export interface WalkForwardBacktestResult {
  readonly folds: readonly FoldResult[];
  readonly meanLogLoss: number;
  readonly medianLogLoss: number;
  readonly meanBrierScore: number;
  readonly pooledMetrics: ProbabilisticMetrics;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** Runs `foldFn` on every precomputed walk-forward fold and aggregates both the unweighted (per-fold mean/median) and weighted (pooled-prediction) views — TASK-045 requirement 7B ("aggregate weighted and unweighted metrics"). */
export function runWalkForwardBacktest(folds: readonly WalkForwardFold[], rows: readonly FeatureRow[], foldFn: FoldModelFn): WalkForwardBacktestResult {
  if (folds.length === 0) throw new ModelingError("insufficient_data", "No walk-forward folds available.");
  const rowsById = buildRowsById(rows);

  const foldResults: FoldResult[] = [];
  const pooledPredicted: number[] = [];
  const pooledActual: number[] = [];

  for (const fold of folds) {
    const trainRows = selectRowsByIds(rowsById, fold.trainMatchInternalIds);
    const validationRows = selectRowsByIds(rowsById, fold.validationMatchInternalIds);
    const predictions = foldFn(trainRows, validationRows);
    if (predictions.length !== validationRows.length) {
      throw new ModelingError("schema_validation_failed", `Fold ${fold.foldId} produced ${predictions.length} predictions for ${validationRows.length} validation rows.`);
    }

    const actual = validationRows.map((r) => r.labelTeamAWin);
    const foldPredictions: FoldPrediction[] = validationRows.map((row, i) => ({ matchInternalId: row.matchInternalId, predicted: predictions[i]!, actual: actual[i]! }));

    pooledPredicted.push(...predictions);
    pooledActual.push(...actual);

    foldResults.push({
      foldId: fold.foldId,
      trainRowCount: fold.trainRowCount,
      validationRowCount: fold.validationRowCount,
      trainStartIso: fold.trainStartIso,
      trainEndIso: fold.trainEndIso,
      validationStartIso: fold.validationStartIso,
      validationEndIso: fold.validationEndIso,
      metrics: computeMetrics(actual, predictions),
      predictions: foldPredictions,
    });
  }

  const foldLogLosses = foldResults.map((f) => f.metrics.logLoss);
  const foldBrierScores = foldResults.map((f) => f.metrics.brierScore);

  return {
    folds: foldResults,
    meanLogLoss: foldLogLosses.reduce((sum, v) => sum + v, 0) / foldLogLosses.length,
    medianLogLoss: median(foldLogLosses),
    meanBrierScore: foldBrierScores.reduce((sum, v) => sum + v, 0) / foldBrierScores.length,
    pooledMetrics: computeMetrics(pooledActual, pooledPredicted),
  };
}
