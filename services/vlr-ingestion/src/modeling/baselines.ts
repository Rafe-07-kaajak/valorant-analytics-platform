import type { FeatureRow } from "../feature/types";

/**
 * Non-learned baselines — TASK-045 requirement 4A. Every candidate learned
 * model is benchmarked against these; if a learned model cannot clearly beat
 * Elo, model selection (section 11) falls back to Elo or a conservative
 * hybrid rather than a learned model chosen on noise.
 */

/** Always predicts the maximally-uninformative 0.5. */
export function constantBaselinePredict(rows: readonly FeatureRow[]): readonly number[] {
  return rows.map(() => 0.5);
}

/** Fits the training-set class prior (Team A win rate) and applies it as a constant prediction — never refit on validation/test. */
export function fitClassPrior(trainRows: readonly FeatureRow[]): number {
  if (trainRows.length === 0) return 0.5;
  const wins = trainRows.reduce((sum, row) => sum + row.labelTeamAWin, 0);
  return wins / trainRows.length;
}

export function classPriorPredict(rows: readonly FeatureRow[], prior: number): readonly number[] {
  return rows.map(() => prior);
}

/** TASK-044's own pre-match Elo-implied win probability — already leakage-safe and chronologically frozen, so it requires no additional fitting here. */
export function eloBaselinePredict(rows: readonly FeatureRow[]): readonly number[] {
  return rows.map((row) => row.teamAEloWinProbability);
}
