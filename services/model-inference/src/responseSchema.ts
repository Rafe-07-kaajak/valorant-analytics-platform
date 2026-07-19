import type { ModelManifest, PredictionOutput } from "@repo/vlr-ingestion";

/**
 * Response contract — TASK-046 requirement 9. Never includes internal
 * filesystem paths, raw coefficients, the full artifact, labels, or ground
 * truth. `confidence` is defined precisely below so it cannot be
 * overstated: it is a bounded distance from a coin-flip, not a claim about
 * real-world accuracy.
 */

export type PredictedWinnerSide = "teamA" | "teamB";

export interface ModelMetadataSummary {
  readonly modelVersion: string;
  readonly estimatorType: string;
  readonly calibrationMethod: string;
  readonly sourceFeatureDatasetVersion: string;
  readonly featureSchemaVersion: string;
}

export interface InferenceResponse {
  readonly requestId: string | undefined;
  readonly modelVersion: string;
  readonly sourceFeatureDatasetVersion: string;
  readonly featureSchemaVersion: string;
  readonly estimatorType: string;
  readonly calibrationMethod: string;
  readonly teamAWinProbability: number;
  readonly teamBWinProbability: number;
  readonly predictedWinnerSide: PredictedWinnerSide;
  /**
   * Distance from a coin-flip, scaled to `[0, 1]`: `|p - 0.5| * 2`. `0`
   * means the model is indifferent between the two teams; `1` means it is
   * maximally certain. This is a property of the model's own output, not a
   * calibrated real-world accuracy estimate — it must never be presented as
   * "this prediction is N% likely to be correct."
   */
  readonly confidence: number;
  readonly predictionGeneratedAt: string;
  readonly inferenceDurationMs: number;
  readonly warnings: readonly string[];
  readonly modelMetadata: ModelMetadataSummary;
}

export interface BuildResponseInput {
  readonly requestId: string | undefined;
  readonly prediction: PredictionOutput;
  readonly manifest: ModelManifest;
  readonly featureSchemaVersion: string;
  readonly inferenceDurationMs: number;
  readonly warnings: readonly string[];
  readonly now: () => Date;
}

export function buildInferenceResponse(input: BuildResponseInput): InferenceResponse {
  const { teamAWinProbability, teamBWinProbability } = input.prediction;
  const threshold = input.manifest.reportingThreshold;
  const predictedWinnerSide: PredictedWinnerSide = teamAWinProbability >= threshold ? "teamA" : "teamB";
  const confidence = Math.min(1, Math.max(0, Math.abs(teamAWinProbability - 0.5) * 2));

  return {
    requestId: input.requestId,
    modelVersion: input.manifest.modelVersion,
    sourceFeatureDatasetVersion: input.manifest.sourceFeatureDatasetVersion,
    featureSchemaVersion: input.featureSchemaVersion,
    estimatorType: input.manifest.estimatorType,
    calibrationMethod: input.manifest.calibrationMethod,
    teamAWinProbability,
    teamBWinProbability,
    predictedWinnerSide,
    confidence,
    predictionGeneratedAt: input.now().toISOString(),
    inferenceDurationMs: input.inferenceDurationMs,
    warnings: input.warnings,
    modelMetadata: {
      modelVersion: input.manifest.modelVersion,
      estimatorType: input.manifest.estimatorType,
      calibrationMethod: input.manifest.calibrationMethod,
      sourceFeatureDatasetVersion: input.manifest.sourceFeatureDatasetVersion,
      featureSchemaVersion: input.featureSchemaVersion,
    },
  };
}
