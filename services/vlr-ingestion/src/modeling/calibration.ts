import { fitLogisticRegression, type LogisticRegressionModel } from "./logisticRegression";
import { clipProbability } from "./metrics";

/**
 * Probability calibration — TASK-045 requirement 9. Both methods are fit
 * strictly on the calibration rows passed in (training/validation only,
 * never test labels — enforced by the caller, see `pipeline.ts`), and
 * walk-forward calibration always respects chronology because it is fit
 * per-fold on that fold's own train/validation rows.
 */

export interface NoCalibration {
  readonly method: "none";
}

export interface SigmoidCalibration {
  readonly method: "sigmoid";
  readonly slope: number;
  readonly intercept: number;
}

export interface IsotonicCalibration {
  readonly method: "isotonic";
  readonly knotX: readonly number[];
  readonly knotY: readonly number[];
}

export type CalibrationModel = NoCalibration | SigmoidCalibration | IsotonicCalibration;

function logit(p: number): number {
  const c = clipProbability(p);
  return Math.log(c / (1 - c));
}

const SIGMOID_CALIBRATION_CONFIG = { l2Lambda: 1e-4, iterations: 500, learningRate: 0.1 };

/** Platt/sigmoid calibration: a 1-D logistic regression of the label against `logit(rawProbability)`, reusing the same estimator as the primary logistic-regression candidate. */
export function fitSigmoidCalibration(rawProbabilities: readonly number[], labels: readonly number[]): SigmoidCalibration {
  const matrix = rawProbabilities.map((p) => [logit(p)]);
  const model: LogisticRegressionModel = fitLogisticRegression(matrix, labels, ["logit"], SIGMOID_CALIBRATION_CONFIG);
  return { method: "sigmoid", slope: model.weights[0]!, intercept: model.bias };
}

export function applySigmoidCalibration(model: SigmoidCalibration, rawProbability: number): number {
  const z = model.slope * logit(rawProbability) + model.intercept;
  return 1 / (1 + Math.exp(-z));
}

/** Minimum calibration-fold sample count below which isotonic regression is skipped — TASK-045 requirement 9 ("avoid isotonic when calibration sample is too small"), since a step function fit on very few points overfits badly. */
export const MIN_ISOTONIC_SAMPLE_COUNT = 50;

/** Pool-adjacent-violators isotonic regression, producing a non-decreasing step function over `[0, 1]`. */
export function fitIsotonicCalibration(rawProbabilities: readonly number[], labels: readonly number[]): IsotonicCalibration {
  const order = rawProbabilities.map((_, i) => i).sort((a, b) => rawProbabilities[a]! - rawProbabilities[b]!);
  const sortedX = order.map((i) => rawProbabilities[i]!);
  const sortedY = order.map((i) => labels[i]!);

  const poolValue: number[] = [];
  const poolWeight: number[] = [];
  for (let i = 0; i < sortedY.length; i += 1) {
    let value = sortedY[i]!;
    let weight = 1;
    while (poolValue.length > 0 && poolValue[poolValue.length - 1]! > value) {
      const prevValue = poolValue.pop()!;
      const prevWeight = poolWeight.pop()!;
      value = (prevValue * prevWeight + value * weight) / (prevWeight + weight);
      weight += prevWeight;
    }
    poolValue.push(value);
    poolWeight.push(weight);
  }

  const knotY: number[] = [];
  for (let k = 0; k < poolValue.length; k += 1) {
    for (let c = 0; c < poolWeight[k]!; c += 1) knotY.push(poolValue[k]!);
  }

  return { method: "isotonic", knotX: sortedX, knotY };
}

export function applyIsotonicCalibration(model: IsotonicCalibration, rawProbability: number): number {
  const { knotX, knotY } = model;
  const n = knotX.length;
  if (n === 0) return rawProbability;
  if (rawProbability <= knotX[0]!) return knotY[0]!;
  if (rawProbability >= knotX[n - 1]!) return knotY[n - 1]!;

  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (knotX[mid]! <= rawProbability) lo = mid;
    else hi = mid;
  }
  const x0 = knotX[lo]!;
  const x1 = knotX[hi]!;
  const y0 = knotY[lo]!;
  const y1 = knotY[hi]!;
  if (x1 === x0) return (y0 + y1) / 2;
  const t = (rawProbability - x0) / (x1 - x0);
  return y0 + t * (y1 - y0);
}

export function applyCalibration(model: CalibrationModel, rawProbability: number): number {
  if (model.method === "none") return rawProbability;
  if (model.method === "sigmoid") return applySigmoidCalibration(model, rawProbability);
  return applyIsotonicCalibration(model, rawProbability);
}

export function applyCalibrationBatch(model: CalibrationModel, rawProbabilities: readonly number[]): readonly number[] {
  return rawProbabilities.map((p) => applyCalibration(model, p));
}
