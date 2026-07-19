/**
 * L2-regularized binary logistic regression — TASK-045 requirement 4B.
 * Fit via full-batch gradient descent with the Adam optimizer, zero-
 * initialized weights, and a fixed iteration count: every input is fully
 * deterministic (no random initialization, no stochastic mini-batching), so
 * no seed is needed for this estimator to reproduce identically across runs.
 */

export interface LogisticRegressionConfig {
  readonly l2Lambda: number;
  readonly iterations: number;
  readonly learningRate: number;
}

export interface LogisticRegressionModel {
  readonly weights: readonly number[];
  readonly bias: number;
  readonly featureNames: readonly string[];
  readonly config: LogisticRegressionConfig;
}

function sigmoid(z: number): number {
  if (z >= 0) {
    const e = Math.exp(-z);
    return 1 / (1 + e);
  }
  const e = Math.exp(z);
  return e / (1 + e);
}

const ADAM_BETA1 = 0.9;
const ADAM_BETA2 = 0.999;
const ADAM_EPSILON = 1e-8;

export function fitLogisticRegression(matrix: readonly (readonly number[])[], labels: readonly number[], featureNames: readonly string[], config: LogisticRegressionConfig): LogisticRegressionModel {
  const n = matrix.length;
  const p = featureNames.length;
  const weights = new Array<number>(p).fill(0);
  let bias = 0;
  const mW = new Array<number>(p).fill(0);
  const vW = new Array<number>(p).fill(0);
  let mB = 0;
  let vB = 0;

  for (let t = 1; t <= config.iterations; t += 1) {
    const gradW = new Array<number>(p).fill(0);
    let gradB = 0;
    for (let i = 0; i < n; i += 1) {
      const row = matrix[i]!;
      let z = bias;
      for (let j = 0; j < p; j += 1) z += weights[j]! * row[j]!;
      const diff = sigmoid(z) - labels[i]!;
      for (let j = 0; j < p; j += 1) gradW[j] += diff * row[j]!;
      gradB += diff;
    }
    for (let j = 0; j < p; j += 1) gradW[j] = gradW[j]! / n + config.l2Lambda * weights[j]!;
    gradB /= n;

    const biasCorrection1 = 1 - ADAM_BETA1 ** t;
    const biasCorrection2 = 1 - ADAM_BETA2 ** t;
    for (let j = 0; j < p; j += 1) {
      mW[j] = ADAM_BETA1 * mW[j]! + (1 - ADAM_BETA1) * gradW[j]!;
      vW[j] = ADAM_BETA2 * vW[j]! + (1 - ADAM_BETA2) * gradW[j]! ** 2;
      const mHat = mW[j]! / biasCorrection1;
      const vHat = vW[j]! / biasCorrection2;
      weights[j] -= (config.learningRate * mHat) / (Math.sqrt(vHat) + ADAM_EPSILON);
    }
    mB = ADAM_BETA1 * mB + (1 - ADAM_BETA1) * gradB;
    vB = ADAM_BETA2 * vB + (1 - ADAM_BETA2) * gradB ** 2;
    const mHatB = mB / biasCorrection1;
    const vHatB = vB / biasCorrection2;
    bias -= (config.learningRate * mHatB) / (Math.sqrt(vHatB) + ADAM_EPSILON);
  }

  return { weights, bias, featureNames, config };
}

export function predictLogisticRegression(model: LogisticRegressionModel, matrix: readonly (readonly number[])[]): readonly number[] {
  return matrix.map((row) => {
    let z = model.bias;
    for (let j = 0; j < model.weights.length; j += 1) z += model.weights[j]! * row[j]!;
    return sigmoid(z);
  });
}

export function predictLogisticRegressionSingle(model: LogisticRegressionModel, row: readonly number[]): number {
  let z = model.bias;
  for (let j = 0; j < model.weights.length; j += 1) z += model.weights[j]! * row[j]!;
  return sigmoid(z);
}
