import { describe, expect, it } from "vitest";
import { fitLogisticRegression, predictLogisticRegression, predictLogisticRegressionSingle } from "./logisticRegression";

const CONFIG = { l2Lambda: 0.01, iterations: 500, learningRate: 0.1 };

describe("fitLogisticRegression", () => {
  it("recovers a clearly separable linear decision boundary with the correct coefficient sign", () => {
    // Positive when x > 0, negative when x < 0 — a trivially separable 1-D problem.
    const matrix = [[-3], [-2], [-1], [1], [2], [3]];
    const labels = [0, 0, 0, 1, 1, 1];
    const model = fitLogisticRegression(matrix, labels, ["x"], CONFIG);
    expect(model.weights[0]).toBeGreaterThan(0);
    const predictions = predictLogisticRegression(model, matrix);
    expect(predictions[0]!).toBeLessThan(0.5);
    expect(predictions[5]!).toBeGreaterThan(0.5);
  });

  it("is fully deterministic across repeated fits on identical input (zero-initialized, no randomness)", () => {
    const matrix = [[1, 2], [2, 1], [0, 3], [3, 0]];
    const labels = [1, 0, 1, 0];
    const modelA = fitLogisticRegression(matrix, labels, ["a", "b"], CONFIG);
    const modelB = fitLogisticRegression(matrix, labels, ["a", "b"], CONFIG);
    expect(modelA.weights).toEqual(modelB.weights);
    expect(modelA.bias).toBe(modelB.bias);
  });

  it("shrinks weights toward zero as the L2 penalty increases", () => {
    const matrix = [[1], [2], [3], [4], [5], [6]];
    const labels = [0, 0, 0, 1, 1, 1];
    const lowReg = fitLogisticRegression(matrix, labels, ["x"], { ...CONFIG, l2Lambda: 0.001 });
    const highReg = fitLogisticRegression(matrix, labels, ["x"], { ...CONFIG, l2Lambda: 5 });
    expect(Math.abs(highReg.weights[0]!)).toBeLessThan(Math.abs(lowReg.weights[0]!));
  });

  it("always predicts a value within [0, 1] (sigmoid saturates to exactly 0/1 in float64 for sufficiently extreme inputs, which is the mathematically correct rounding, not an error)", () => {
    const matrix = [[3], [-3]];
    const labels = [1, 0];
    const model = fitLogisticRegression(matrix, labels, ["x"], CONFIG);
    for (const p of predictLogisticRegression(model, matrix)) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it("predictLogisticRegressionSingle agrees with the batch predictor", () => {
    const matrix = [[1, -1], [2, 3]];
    const labels = [1, 0];
    const model = fitLogisticRegression(matrix, labels, ["a", "b"], CONFIG);
    const batch = predictLogisticRegression(model, matrix);
    expect(predictLogisticRegressionSingle(model, matrix[0]!)).toBeCloseTo(batch[0]!, 12);
    expect(predictLogisticRegressionSingle(model, matrix[1]!)).toBeCloseTo(batch[1]!, 12);
  });
});
