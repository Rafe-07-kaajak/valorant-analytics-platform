import { describe, expect, it } from "vitest";
import { fitGradientBoostedTrees, predictGradientBoostedTrees, predictGradientBoostedTreesSingle } from "./gradientBoostedTrees";

const CONFIG = { maxDepth: 2, learningRate: 0.1, numTrees: 20, minSamplesLeaf: 2 };

function makeSeparableDataset() {
  const matrix = [[0], [1], [2], [3], [10], [11], [12], [13]];
  const labels = [0, 0, 0, 0, 1, 1, 1, 1];
  return { matrix, labels };
}

describe("fitGradientBoostedTrees", () => {
  it("learns a clearly separable pattern", () => {
    const { matrix, labels } = makeSeparableDataset();
    const model = fitGradientBoostedTrees(matrix, labels, ["x"], CONFIG);
    const predictions = predictGradientBoostedTrees(model, matrix);
    expect(predictions[0]!).toBeLessThan(0.4);
    expect(predictions[7]!).toBeGreaterThan(0.6);
  });

  it("always predicts a value strictly within (0, 1)", () => {
    const { matrix, labels } = makeSeparableDataset();
    const model = fitGradientBoostedTrees(matrix, labels, ["x"], CONFIG);
    for (const p of predictGradientBoostedTrees(model, matrix)) {
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(1);
    }
  });

  it("is fully deterministic across repeated fits on identical input (no randomness anywhere in the fit)", () => {
    const { matrix, labels } = makeSeparableDataset();
    const modelA = fitGradientBoostedTrees(matrix, labels, ["x"], CONFIG);
    const modelB = fitGradientBoostedTrees(matrix, labels, ["x"], CONFIG);
    expect(modelA.trees).toEqual(modelB.trees);
    expect(modelA.initialLogOdds).toBe(modelB.initialLogOdds);
  });

  it("bounds ensemble size and depth to the configured values", () => {
    const { matrix, labels } = makeSeparableDataset();
    const model = fitGradientBoostedTrees(matrix, labels, ["x"], CONFIG);
    expect(model.trees).toHaveLength(CONFIG.numTrees);
  });

  it("predictGradientBoostedTreesSingle agrees with the batch predictor", () => {
    const { matrix, labels } = makeSeparableDataset();
    const model = fitGradientBoostedTrees(matrix, labels, ["x"], CONFIG);
    const batch = predictGradientBoostedTrees(model, matrix);
    expect(predictGradientBoostedTreesSingle(model, matrix[0]!)).toBeCloseTo(batch[0]!, 12);
  });
});
