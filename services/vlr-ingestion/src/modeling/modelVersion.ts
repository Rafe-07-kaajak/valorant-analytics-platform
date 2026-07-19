import { createHash } from "node:crypto";
import { contentHashOf } from "../feature/featureVersion";

/**
 * Deterministic model versioning — TASK-045 requirement 15/17. Mirrors
 * `feature/featureVersion.ts`'s approach exactly: the same source feature
 * dataset, preprocessing configuration, estimator configuration, and
 * calibration configuration always reproduce the same `modelVersion` —
 * never a random UUID, never dependent on `generatedAt`.
 */
export const MODELING_RULES_VERSION = "vlr-modeling-rules@1.0.0";

export interface ModelVersionInputs {
  readonly featureDatasetVersion: string;
  readonly preprocessingConfig: unknown;
  readonly estimatorConfig: unknown;
  readonly calibrationConfig: unknown;
}

export function computeModelVersion(inputs: ModelVersionInputs): string {
  const canonical = JSON.stringify({
    modelingRulesVersion: MODELING_RULES_VERSION,
    featureDatasetVersion: inputs.featureDatasetVersion,
    preprocessingConfigHash: contentHashOf(inputs.preprocessingConfig),
    estimatorConfigHash: contentHashOf(inputs.estimatorConfig),
    calibrationConfigHash: contentHashOf(inputs.calibrationConfig),
  });
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

export { contentHashOf };
