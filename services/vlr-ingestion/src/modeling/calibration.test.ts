import { describe, expect, it } from "vitest";
import { applyCalibration, applyCalibrationBatch, applyIsotonicCalibration, applySigmoidCalibration, fitIsotonicCalibration, fitSigmoidCalibration } from "./calibration";

describe("sigmoid calibration", () => {
  it("recovers near-identity calibration for already well-calibrated predictions", () => {
    const raw = [0.1, 0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9];
    const labels = [0, 0, 0, 0, 1, 1, 1, 1];
    const model = fitSigmoidCalibration(raw, labels);
    const calibrated = raw.map((p) => applySigmoidCalibration(model, p));
    // Order-preserving: calibration must never invert the ranking of raw predictions.
    for (let i = 1; i < calibrated.length; i += 1) expect(calibrated[i]!).toBeGreaterThanOrEqual(calibrated[i - 1]!);
  });

  it("always produces a probability within [0, 1] (extreme raw inputs can legitimately saturate to exactly 0/1 in float64)", () => {
    const model = fitSigmoidCalibration([0.2, 0.8], [0, 1]);
    for (const p of [0.1, 0.5, 0.9]) {
      const calibrated = applySigmoidCalibration(model, p);
      expect(calibrated).toBeGreaterThanOrEqual(0);
      expect(calibrated).toBeLessThanOrEqual(1);
    }
  });
});

describe("isotonic calibration", () => {
  it("produces a non-decreasing step function", () => {
    const raw = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    const labels = raw.map((_, i) => (i % 3 === 0 ? 0 : 1));
    const model = fitIsotonicCalibration(raw, labels);
    let previous = -Infinity;
    for (const x of [0, 0.15, 0.35, 0.55, 0.75, 0.95, 1]) {
      const value = applyIsotonicCalibration(model, x);
      expect(value).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = value;
    }
  });

  it("clamps predictions outside the training range to the boundary knots", () => {
    const model = fitIsotonicCalibration([0.3, 0.5, 0.7], [0, 1, 1]);
    expect(applyIsotonicCalibration(model, -1)).toBe(applyIsotonicCalibration(model, 0.3));
    expect(applyIsotonicCalibration(model, 2)).toBe(applyIsotonicCalibration(model, 0.7));
  });
});

describe("applyCalibration dispatch", () => {
  it("'none' is the identity function", () => {
    expect(applyCalibration({ method: "none" }, 0.37)).toBe(0.37);
    expect(applyCalibrationBatch({ method: "none" }, [0.1, 0.9])).toEqual([0.1, 0.9]);
  });
});
