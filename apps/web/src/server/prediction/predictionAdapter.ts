import type { InferenceRequest, FeatureValue } from "@repo/model-inference";
import type { HistoricalPredictionResponse } from "@repo/shared";
import { getHistoricalRowById, validateMatchInternalId, type RawHistoricalRow } from "./historicalFeatureRepository";
import { getReadyModelService } from "./modelService";
import { PredictionApiError, toPredictionApiError } from "./errors";
import { loadRealPredictionConfig } from "./config";

/**
 * Backend adapter — TASK-047 requirement 7/15. The only place a historical
 * feature row is translated into a TASK-046 `InferenceRequest` and an
 * `InferenceResponse` is translated back into this task's own browser-safe
 * `HistoricalPredictionResponse`. Never accepts a raw feature row from the
 * browser: the caller supplies only a `matchInternalId`, and every feature
 * value fed to the model comes from the server's own stored dataset.
 */

export interface HistoricalPredictionInput {
  readonly matchInternalId: unknown;
  readonly requestId?: string;
  readonly requestedModelVersion?: string;
}

/** Builds the model's `features` object strictly from the artifact's own `requiredInputFields` — a field never listed there (every identifier/label/lineage field) is never copied, so labels cannot leak into the model input by construction. */
function buildFeaturesFromRow(row: RawHistoricalRow, requiredInputFields: readonly string[]): Record<string, FeatureValue> {
  const features: Record<string, FeatureValue> = {};
  for (const field of requiredInputFields) {
    if (!Object.prototype.hasOwnProperty.call(row, field)) continue;
    const value = row[field];
    if (value === undefined) continue;
    features[field] = value as FeatureValue;
  }
  return features;
}

function toMatchMetadata(row: RawHistoricalRow) {
  return {
    matchInternalId: row.matchInternalId,
    scheduledAt: row.scheduledAt,
    eventFamily: row.eventFamily,
    eventRegion: row.eventRegion,
    tournamentLevel: row.tournamentLevel,
    seriesFormat: row.seriesFormat,
    teamAProviderId: row.teamAProviderId,
    teamBProviderId: row.teamBProviderId,
  };
}

export async function predictHistoricalMatch(input: HistoricalPredictionInput): Promise<HistoricalPredictionResponse> {
  const config = loadRealPredictionConfig();
  if (!config.enabled) {
    throw new PredictionApiError("model_unavailable", "Real (historical-replay) prediction is disabled by configuration.");
  }

  const matchInternalId = validateMatchInternalId(input.matchInternalId);
  const row = await getHistoricalRowById(matchInternalId);

  const service = await getReadyModelService();
  const artifact = service.registry.getCurrentArtifact();

  // Row's *own* recorded feature schema/rules version — not the artifact's —
  // is deliberately sent as the request's version fields, so a genuine
  // drift between the dataset a row was generated under and the currently
  // loaded model surfaces as a real `feature_dataset_version_mismatch`
  // rather than being silently papered over.
  const request: InferenceRequest = {
    requestId: input.requestId,
    matchInternalId: row.matchInternalId,
    featureSchemaVersion: typeof row.featureSchemaVersion === "string" ? row.featureSchemaVersion : "",
    featureRulesVersion: typeof row.featureRulesVersion === "string" ? row.featureRulesVersion : "",
    sourceFeatureDatasetVersion: typeof row.sourceDatasetVersion === "string" ? row.sourceDatasetVersion : undefined,
    requestedModelVersion: input.requestedModelVersion,
    features: artifact ? buildFeaturesFromRow(row, artifact.featureContract.requiredInputFields) : {},
  };

  let response;
  try {
    response = await service.predict(request);
  } catch (error) {
    throw toPredictionApiError(error);
  }

  return {
    mode: "historical-real-model",
    requestId: response.requestId,
    match: toMatchMetadata(row),
    modelVersion: response.modelVersion,
    estimatorType: response.estimatorType,
    calibrationMethod: response.calibrationMethod,
    sourceFeatureDatasetVersion: response.sourceFeatureDatasetVersion,
    featureSchemaVersion: response.featureSchemaVersion,
    teamAWinProbability: response.teamAWinProbability,
    teamBWinProbability: response.teamBWinProbability,
    predictedWinnerSide: response.predictedWinnerSide,
    confidence: response.confidence,
    warnings: response.warnings,
    predictionGeneratedAt: response.predictionGeneratedAt,
    inferenceDurationMs: response.inferenceDurationMs,
    dataProvenance: {
      sourceFeatureDatasetVersion: response.sourceFeatureDatasetVersion,
      featureSchemaVersion: response.featureSchemaVersion,
      generatedFromHistoricalSnapshot: true,
    },
    // Reveal-after-prediction (TASK-047 section 14) was scoped but not
    // built in this pass — see docs/35, "Known limitations".
    resultAvailability: { actualResultRevealable: false },
  };
}
