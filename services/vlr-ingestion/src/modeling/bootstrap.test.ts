import { describe, expect, it } from "vitest";
import { bootstrapMetric, computeTestSetUncertainty } from "./bootstrap";
import { accuracyAtThreshold } from "./metrics";

describe("bootstrapMetric", () => {
  const actual = [1, 0, 1, 0, 1, 1, 0, 0, 1, 0];
  const predicted = [0.8, 0.2, 0.7, 0.3, 0.6, 0.9, 0.4, 0.1, 0.6, 0.3];

  it("is deterministic for a fixed seed", () => {
    const a = bootstrapMetric(actual, predicted, accuracyAtThreshold, 7, 200);
    const b = bootstrapMetric(actual, predicted, accuracyAtThreshold, 7, 200);
    expect(a).toEqual(b);
  });

  it("produces a lower and upper bound that bracket the point estimate for a well-behaved metric", () => {
    const ci = bootstrapMetric(actual, predicted, accuracyAtThreshold, 7, 500);
    expect(ci.lowerP2_5).toBeLessThanOrEqual(ci.point + 1e-9);
    expect(ci.upperP97_5).toBeGreaterThanOrEqual(ci.point - 1e-9);
  });

  it("different seeds can produce different resamples but the same point estimate", () => {
    const a = bootstrapMetric(actual, predicted, accuracyAtThreshold, 1, 200);
    const b = bootstrapMetric(actual, predicted, accuracyAtThreshold, 2, 200);
    expect(a.point).toBe(b.point);
  });
});

describe("computeTestSetUncertainty", () => {
  it("reports log loss, Brier score, accuracy, and a model-minus-Elo difference", () => {
    const actual = [1, 0, 1, 0, 1];
    const model = [0.7, 0.3, 0.6, 0.2, 0.8];
    const elo = [0.5, 0.5, 0.5, 0.5, 0.5];
    const result = computeTestSetUncertainty(actual, model, elo, 45045, 300);
    expect(result.logLoss.point).toBeGreaterThan(0);
    expect(result.brierScore.point).toBeGreaterThanOrEqual(0);
    expect(result.accuracy.point).toBeGreaterThanOrEqual(0);
    expect(result.logLossMinusElo.point).toBeLessThan(0); // The model is more confidently correct than the flat-0.5 Elo predictions here.
  });
});
