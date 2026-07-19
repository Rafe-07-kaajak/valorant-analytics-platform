import { createRng, randomInt } from "./prng";
import { logLoss } from "./metrics";
import { predictGradientBoostedTrees, type GradientBoostedTreesModel } from "./gradientBoostedTrees";
import type { LogisticRegressionModel } from "./logisticRegression";
import type { FeatureImportanceEntry, FeatureImportanceReport } from "./artifact";

/**
 * Feature importance / explainability — TASK-045 requirement 14. Logistic
 * regression's standardized coefficients are read directly off the fitted
 * model (no extra computation needed, since preprocessing already
 * standardizes every numeric input). The tree ensemble instead uses
 * permutation importance computed on held-out rows only, with a fixed seed
 * so repeated runs agree — impurity-based importance is not reported, since
 * this task treats every importance measure as associative, never causal.
 */

const TOP_N = 15;
const NEUTRAL_THRESHOLD = 1e-6;
const IMPORTANCE_CAVEAT = "Feature importance is associative, not causal: it describes what the fitted model relied on for its predictions on this dataset, not a validated causal driver of match outcomes.";

function directionOf(value: number): "positive" | "negative" | "neutral" {
  if (value > NEUTRAL_THRESHOLD) return "positive";
  if (value < -NEUTRAL_THRESHOLD) return "negative";
  return "neutral";
}

export function logisticFeatureImportance(model: LogisticRegressionModel): FeatureImportanceReport {
  const entries: FeatureImportanceEntry[] = model.featureNames.map((feature, i) => ({ feature, value: model.weights[i]!, direction: directionOf(model.weights[i]!) }));
  const topPositive = [...entries].filter((e) => e.direction === "positive").sort((a, b) => b.value - a.value).slice(0, TOP_N);
  const topNegative = [...entries].filter((e) => e.direction === "negative").sort((a, b) => a.value - b.value).slice(0, TOP_N);
  const zeroOrUnusedFeatures = entries.filter((e) => e.direction === "neutral").map((e) => e.feature);
  return { method: "standardized-coefficient", topPositive, topNegative, unstableFeatures: [], zeroOrUnusedFeatures, caveat: IMPORTANCE_CAVEAT };
}

const PERMUTATION_REPEATS = 5;
const PERMUTATION_SEED = 45045;

/** Permutation importance: shuffling a genuinely important feature's values across rows should increase log loss; shuffling a genuinely unused one should not. Computed on `matrix`/`labels` (validation or test — never training rows, since permutation importance on training data is optimistically biased). */
export function permutationFeatureImportance(model: GradientBoostedTreesModel, matrix: readonly (readonly number[])[], labels: readonly number[], featureNames: readonly string[]): FeatureImportanceReport {
  const baselineLogLoss = logLoss(labels, predictGradientBoostedTrees(model, matrix));
  const rng = createRng(PERMUTATION_SEED);
  const entries: FeatureImportanceEntry[] = [];

  for (let featureIndex = 0; featureIndex < featureNames.length; featureIndex += 1) {
    let totalIncrease = 0;
    for (let repeat = 0; repeat < PERMUTATION_REPEATS; repeat += 1) {
      const columnValues = matrix.map((row) => row[featureIndex]!);
      const permutedColumn = fisherYatesShuffle(columnValues, rng);
      const permutedMatrix = matrix.map((row, i) => row.map((v, j) => (j === featureIndex ? permutedColumn[i]! : v)));
      const permutedLogLoss = logLoss(labels, predictGradientBoostedTrees(model, permutedMatrix));
      totalIncrease += permutedLogLoss - baselineLogLoss;
    }
    entries.push({ feature: featureNames[featureIndex]!, value: totalIncrease / PERMUTATION_REPEATS, direction: directionOf(totalIncrease) });
  }

  const topPositive = [...entries].sort((a, b) => b.value - a.value).slice(0, TOP_N);
  const topNegative = [...entries].sort((a, b) => a.value - b.value).filter((e) => e.value < 0).slice(0, TOP_N);
  const zeroOrUnusedFeatures = entries.filter((e) => e.direction === "neutral").map((e) => e.feature);
  return { method: "permutation-importance", topPositive, topNegative, unstableFeatures: [], zeroOrUnusedFeatures, caveat: IMPORTANCE_CAVEAT };
}

function fisherYatesShuffle<T>(values: readonly T[], rng: ReturnType<typeof createRng>): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(rng, i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
