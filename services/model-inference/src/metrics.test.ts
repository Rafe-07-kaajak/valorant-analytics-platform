import { describe, expect, it } from "vitest";
import { InferenceMetrics } from "./metrics";

describe("InferenceMetrics", () => {
  it("starts at all zeros / nulls", () => {
    const metrics = new InferenceMetrics();
    const snapshot = metrics.snapshot();
    expect(snapshot.inferenceCount).toBe(0);
    expect(snapshot.inferenceFailureCount).toBe(0);
    expect(snapshot.averageInferenceDurationMs).toBeNull();
    expect(snapshot.lastInferenceAt).toBeNull();
  });

  it("counts successes and computes an average duration", () => {
    const metrics = new InferenceMetrics();
    metrics.recordInferenceSuccess(10);
    metrics.recordInferenceSuccess(20);
    const snapshot = metrics.snapshot();
    expect(snapshot.inferenceCount).toBe(2);
    expect(snapshot.averageInferenceDurationMs).toBe(15);
    expect(snapshot.lastInferenceAt).not.toBeNull();
  });

  it("counts failures by stable error code, without high-cardinality labels", () => {
    const metrics = new InferenceMetrics();
    metrics.recordInferenceFailure("missing_feature");
    metrics.recordInferenceFailure("missing_feature");
    metrics.recordInferenceFailure("non_finite_feature");
    const snapshot = metrics.snapshot();
    expect(snapshot.inferenceFailureCount).toBe(3);
    expect(snapshot.errorCodeCounts.missing_feature).toBe(2);
    expect(snapshot.errorCodeCounts.non_finite_feature).toBe(1);
  });

  it("tracks reload success/failure counters independently of inference counters", () => {
    const metrics = new InferenceMetrics();
    metrics.recordReloadSuccess();
    metrics.recordReloadFailure("artifact_hash_mismatch");
    const snapshot = metrics.snapshot();
    expect(snapshot.reloadCount).toBe(2);
    expect(snapshot.reloadFailureCount).toBe(1);
  });

  it("bounds the duration window rather than growing unboundedly", () => {
    const metrics = new InferenceMetrics();
    for (let i = 0; i < 500; i += 1) metrics.recordInferenceSuccess(i);
    const snapshot = metrics.snapshot();
    expect(snapshot.inferenceCount).toBe(500);
    // p50/p95 are computed only over the bounded rolling window, so they
    // reflect the most recent durations, not the full 500-call history.
    expect(snapshot.p95InferenceDurationMs).toBeGreaterThan(300);
  });

  it("computes p50/p95 over a known duration set", () => {
    const metrics = new InferenceMetrics();
    for (let i = 1; i <= 100; i += 1) metrics.recordInferenceSuccess(i);
    const snapshot = metrics.snapshot();
    expect(snapshot.p50InferenceDurationMs).toBeGreaterThanOrEqual(50);
    expect(snapshot.p95InferenceDurationMs).toBeGreaterThanOrEqual(95);
  });
});
