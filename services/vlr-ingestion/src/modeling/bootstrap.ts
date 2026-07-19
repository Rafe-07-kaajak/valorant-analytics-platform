import { createRng, randomInt, type Rng } from "./prng";
import { accuracyAtThreshold, brierScore, logLoss } from "./metrics";

/**
 * Bootstrap confidence intervals over already-computed predictions —
 * TASK-045 requirement 12. Given this dataset's size (a few dozen to a few
 * hundred rows per evaluation set), these intervals are reported as
 * descriptive uncertainty rather than a claim of formal statistical
 * significance (see docs/33, "Known limitations") — resampling rows is not
 * strictly i.i.d. given the chronological/tournament structure of the data,
 * a limitation this module does not attempt to correct for.
 */

const DEFAULT_BOOTSTRAP_SEED = 45045;
const DEFAULT_BOOTSTRAP_ITERATIONS = 2000;

export interface ConfidenceInterval {
  readonly point: number;
  readonly lowerP2_5: number;
  readonly upperP97_5: number;
  readonly iterations: number;
  readonly seed: number;
}

function percentile(sortedValues: readonly number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.round(p * (sortedValues.length - 1))));
  return sortedValues[index]!;
}

function bootstrapStatistic(n: number, statisticFn: (indices: readonly number[]) => number, iterations: number, rng: Rng): number[] {
  const results: number[] = [];
  for (let iter = 0; iter < iterations; iter += 1) {
    const indices = Array.from({ length: n }, () => randomInt(rng, n));
    results.push(statisticFn(indices));
  }
  return results.sort((a, b) => a - b);
}

function resample(values: readonly number[], indices: readonly number[]): number[] {
  return indices.map((i) => values[i]!);
}

export function bootstrapMetric(actual: readonly number[], predicted: readonly number[], metricFn: (a: readonly number[], p: readonly number[]) => number, seed = DEFAULT_BOOTSTRAP_SEED, iterations = DEFAULT_BOOTSTRAP_ITERATIONS): ConfidenceInterval {
  const rng = createRng(seed);
  const point = metricFn(actual, predicted);
  const samples = bootstrapStatistic(actual.length, (indices) => metricFn(resample(actual, indices), resample(predicted, indices)), iterations, rng);
  return { point, lowerP2_5: percentile(samples, 0.025), upperP97_5: percentile(samples, 0.975), iterations, seed };
}

export interface TestSetUncertainty {
  readonly logLoss: ConfidenceInterval;
  readonly brierScore: ConfidenceInterval;
  readonly accuracy: ConfidenceInterval;
  readonly logLossMinusElo: ConfidenceInterval;
  readonly brierScoreMinusElo: ConfidenceInterval;
}

/** TASK-045 requirement 12 ("at minimum provide uncertainty for: log loss, Brier score, accuracy, model minus Elo metric difference"). */
export function computeTestSetUncertainty(actual: readonly number[], modelPredicted: readonly number[], eloPredicted: readonly number[], seed = DEFAULT_BOOTSTRAP_SEED, iterations = DEFAULT_BOOTSTRAP_ITERATIONS): TestSetUncertainty {
  const rng = createRng(seed);
  const n = actual.length;

  const logLossPoint = logLoss(actual, modelPredicted);
  const brierPoint = brierScore(actual, modelPredicted);
  const accuracyPoint = accuracyAtThreshold(actual, modelPredicted);
  const logLossDiffPoint = logLoss(actual, modelPredicted) - logLoss(actual, eloPredicted);
  const brierDiffPoint = brierScore(actual, modelPredicted) - brierScore(actual, eloPredicted);

  const logLossSamples: number[] = [];
  const brierSamples: number[] = [];
  const accuracySamples: number[] = [];
  const logLossDiffSamples: number[] = [];
  const brierDiffSamples: number[] = [];

  for (let iter = 0; iter < iterations; iter += 1) {
    const indices = Array.from({ length: n }, () => randomInt(rng, n));
    const rActual = resample(actual, indices);
    const rModel = resample(modelPredicted, indices);
    const rElo = resample(eloPredicted, indices);
    logLossSamples.push(logLoss(rActual, rModel));
    brierSamples.push(brierScore(rActual, rModel));
    accuracySamples.push(accuracyAtThreshold(rActual, rModel));
    logLossDiffSamples.push(logLoss(rActual, rModel) - logLoss(rActual, rElo));
    brierDiffSamples.push(brierScore(rActual, rModel) - brierScore(rActual, rElo));
  }

  logLossSamples.sort((a, b) => a - b);
  brierSamples.sort((a, b) => a - b);
  accuracySamples.sort((a, b) => a - b);
  logLossDiffSamples.sort((a, b) => a - b);
  brierDiffSamples.sort((a, b) => a - b);

  const toCi = (point: number, samples: readonly number[]): ConfidenceInterval => ({ point, lowerP2_5: percentile(samples, 0.025), upperP97_5: percentile(samples, 0.975), iterations, seed });

  return {
    logLoss: toCi(logLossPoint, logLossSamples),
    brierScore: toCi(brierPoint, brierSamples),
    accuracy: toCi(accuracyPoint, accuracySamples),
    logLossMinusElo: toCi(logLossDiffPoint, logLossDiffSamples),
    brierScoreMinusElo: toCi(brierDiffPoint, brierDiffSamples),
  };
}
