import type { RegistrySnapshot } from "./registry";
import type { MetricsSnapshot } from "./metrics";

/**
 * Health/readiness — TASK-046 requirement 15. Two tiers: a minimal
 * public-safe status (safe to return to any caller, including a future
 * external health-check endpoint) and a richer internal status (still safe
 * — no raw filesystem paths, no stack traces, no artifact content — but
 * with the operational detail needed for debugging/dashboards).
 */

export interface LivenessStatus {
  readonly alive: true;
  readonly timestamp: string;
}

export function buildLiveness(now: () => Date = () => new Date()): LivenessStatus {
  return { alive: true, timestamp: now().toISOString() };
}

export interface PublicReadinessStatus {
  readonly ready: boolean;
  readonly status: RegistrySnapshot["status"];
  readonly modelVersion: string | null;
  readonly estimatorType: string | null;
  readonly timestamp: string;
}

export function buildPublicReadiness(snapshot: RegistrySnapshot, now: () => Date = () => new Date()): PublicReadinessStatus {
  return {
    ready: snapshot.ready,
    status: snapshot.status,
    modelVersion: snapshot.modelVersion,
    estimatorType: snapshot.estimatorType,
    timestamp: now().toISOString(),
  };
}

export interface InternalStatus {
  readonly registry: RegistrySnapshot;
  readonly metrics: MetricsSnapshot;
  readonly timestamp: string;
}

export function buildInternalStatus(snapshot: RegistrySnapshot, metrics: MetricsSnapshot, now: () => Date = () => new Date()): InternalStatus {
  return { registry: snapshot, metrics, timestamp: now().toISOString() };
}
