/**
 * Lightweight in-process observability — TASK-046 requirement 18. No new
 * dependency, no external metrics backend, no high-cardinality labels (only
 * a fixed, small set of error codes is ever used as a counter key). Never
 * stores feature values, request payloads, or player/provider IDs.
 */

import type { InferenceErrorCode } from "./errors";

const DURATION_WINDOW_SIZE = 200;

export interface MetricsSnapshot {
  readonly inferenceCount: number;
  readonly inferenceFailureCount: number;
  readonly reloadCount: number;
  readonly reloadFailureCount: number;
  readonly lastInferenceAt: string | null;
  readonly averageInferenceDurationMs: number | null;
  readonly p50InferenceDurationMs: number | null;
  readonly p95InferenceDurationMs: number | null;
  readonly errorCodeCounts: Readonly<Partial<Record<InferenceErrorCode, number>>>;
}

export class InferenceMetrics {
  private inferenceCount = 0;
  private inferenceFailureCount = 0;
  private reloadCount = 0;
  private reloadFailureCount = 0;
  private lastInferenceAt: string | null = null;
  private readonly durationsMs: number[] = [];
  private readonly errorCodeCounts = new Map<InferenceErrorCode, number>();

  recordInferenceSuccess(durationMs: number, now: () => Date = () => new Date()): void {
    this.inferenceCount += 1;
    this.lastInferenceAt = now().toISOString();
    this.durationsMs.push(durationMs);
    if (this.durationsMs.length > DURATION_WINDOW_SIZE) this.durationsMs.shift();
  }

  recordInferenceFailure(code: InferenceErrorCode): void {
    this.inferenceFailureCount += 1;
    this.errorCodeCounts.set(code, (this.errorCodeCounts.get(code) ?? 0) + 1);
  }

  recordReloadSuccess(): void {
    this.reloadCount += 1;
  }

  recordReloadFailure(code: InferenceErrorCode): void {
    this.reloadCount += 1;
    this.reloadFailureCount += 1;
    this.errorCodeCounts.set(code, (this.errorCodeCounts.get(code) ?? 0) + 1);
  }

  private percentile(p: number): number | null {
    if (this.durationsMs.length === 0) return null;
    const sorted = [...this.durationsMs].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
    return sorted[index]!;
  }

  snapshot(): MetricsSnapshot {
    const average = this.durationsMs.length > 0 ? this.durationsMs.reduce((sum, v) => sum + v, 0) / this.durationsMs.length : null;
    return {
      inferenceCount: this.inferenceCount,
      inferenceFailureCount: this.inferenceFailureCount,
      reloadCount: this.reloadCount,
      reloadFailureCount: this.reloadFailureCount,
      lastInferenceAt: this.lastInferenceAt,
      averageInferenceDurationMs: average,
      p50InferenceDurationMs: this.percentile(0.5),
      p95InferenceDurationMs: this.percentile(0.95),
      errorCodeCounts: Object.fromEntries(this.errorCodeCounts),
    };
  }
}
