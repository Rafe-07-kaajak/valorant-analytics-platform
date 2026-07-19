import { describe, expect, it } from "vitest";
import { accuracyAtThreshold, balancedAccuracy, brierScore, calibrationSlopeIntercept, clipProbability, expectedCalibrationError, logLoss, precisionRecallF1, reliabilityBins, rocAuc } from "./metrics";

describe("clipProbability", () => {
  it("clips exact 0 and 1 strictly inside (0, 1)", () => {
    expect(clipProbability(0)).toBeGreaterThan(0);
    expect(clipProbability(1)).toBeLessThan(1);
  });

  it("leaves interior values untouched", () => {
    expect(clipProbability(0.42)).toBe(0.42);
  });
});

describe("logLoss", () => {
  it("is near zero for confident correct predictions", () => {
    expect(logLoss([1, 0, 1], [0.99, 0.01, 0.99])).toBeLessThan(0.02);
  });

  it("is large for confident wrong predictions", () => {
    expect(logLoss([1, 0], [0.01, 0.99])).toBeGreaterThan(4);
  });

  it("never returns NaN or Infinity even at probability 0 or 1", () => {
    const value = logLoss([1, 0], [1, 0]);
    expect(Number.isFinite(value)).toBe(true);
  });

  it("equals ln(2) for a constant 0.5 prediction regardless of labels", () => {
    expect(logLoss([1, 0, 1, 0], [0.5, 0.5, 0.5, 0.5])).toBeCloseTo(Math.log(2), 10);
  });
});

describe("brierScore", () => {
  it("is 0 for perfect predictions", () => {
    expect(brierScore([1, 0], [1, 0])).toBe(0);
  });

  it("is 1 for maximally wrong predictions", () => {
    expect(brierScore([1, 0], [0, 1])).toBe(1);
  });
});

describe("rocAuc", () => {
  it("is 1 when positives are always ranked above negatives", () => {
    expect(rocAuc([0, 0, 1, 1], [0.1, 0.2, 0.8, 0.9])).toBe(1);
  });

  it("is 0 when positives are always ranked below negatives", () => {
    expect(rocAuc([0, 0, 1, 1], [0.9, 0.8, 0.2, 0.1])).toBe(0);
  });

  it("is 0.5 for a random-order tie", () => {
    expect(rocAuc([0, 1], [0.5, 0.5])).toBe(0.5);
  });

  it("returns null when only one class is present", () => {
    expect(rocAuc([1, 1, 1], [0.5, 0.6, 0.7])).toBeNull();
  });
});

describe("accuracyAtThreshold / balancedAccuracy / precisionRecallF1", () => {
  const yTrue = [1, 1, 0, 0];
  const yPred = [0.9, 0.4, 0.3, 0.8];

  it("computes accuracy at the default 0.5 threshold", () => {
    expect(accuracyAtThreshold(yTrue, yPred)).toBe(0.5);
  });

  it("computes balanced accuracy", () => {
    expect(balancedAccuracy(yTrue, yPred)).toBe(0.5);
  });

  it("computes precision/recall/f1", () => {
    const result = precisionRecallF1(yTrue, yPred);
    expect(result.precision).toBeCloseTo(0.5, 10);
    expect(result.recall).toBeCloseTo(0.5, 10);
  });
});

describe("reliabilityBins / expectedCalibrationError", () => {
  it("reports zero ECE for perfectly calibrated bins", () => {
    const bins = reliabilityBins([1, 0, 1, 0], [0.5, 0.5, 0.5, 0.5], 2);
    expect(expectedCalibrationError(bins)).toBeCloseTo(0, 10);
  });

  it("reports empty bins with zero count rather than omitting them", () => {
    const bins = reliabilityBins([1], [0.95], 10);
    expect(bins).toHaveLength(10);
    expect(bins.filter((b) => b.count === 0).length).toBe(9);
  });
});

describe("calibrationSlopeIntercept", () => {
  it("returns null when fewer than two bins are populated", () => {
    const bins = reliabilityBins([1], [0.95], 10);
    expect(calibrationSlopeIntercept(bins)).toBeNull();
  });

  it("returns slope close to 1 and intercept close to 0 for well-calibrated predictions", () => {
    // Two bins, each genuinely calibrated: among rows predicted 0.8, exactly 80% are positive; among rows predicted 0.2, exactly 20% are positive.
    const yTrue = [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0];
    const yPred = [0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2];
    const bins = reliabilityBins(yTrue, yPred, 10);
    const result = calibrationSlopeIntercept(bins);
    expect(result).not.toBeNull();
    expect(result!.slope).toBeCloseTo(1, 5);
    expect(result!.intercept).toBeCloseTo(0, 5);
  });
});
