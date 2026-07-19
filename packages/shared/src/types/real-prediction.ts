/**
 * Browser-safe contracts for TASK-047's real (historical-replay) prediction
 * integration — see docs/35-real-prediction-backend-integration.md. These
 * types describe only what may cross the server/client boundary: safe match
 * metadata, model provenance, and a probability. They never carry a raw
 * feature row, an artifact path, or a label/actual-result field.
 *
 * `PredictionResult` (./prediction.ts) — the synthetic-scenario engine's own
 * contract — is deliberately left untouched by this file; the two modes are
 * unified only at the display layer (see `apps/web`'s `PredictionDisplayResult`),
 * never by changing the synthetic engine's existing contract.
 */

export type PredictionMode = "synthetic-scenario" | "historical-real-model";

export interface HistoricalMatchSummary {
  readonly matchInternalId: string;
  readonly scheduledAt: string;
  readonly eventFamily: string;
  readonly eventRegion: string;
  readonly tournamentLevel: string;
  readonly seriesFormat: string;
  readonly teamAProviderId: string;
  readonly teamBProviderId: string;
  readonly modelEligible: boolean;
  readonly featureDatasetVersion: string;
}

export interface HistoricalCatalogResponse {
  readonly matches: readonly HistoricalMatchSummary[];
  readonly total: number;
  readonly featureDatasetVersion: string;
}

export interface HistoricalPredictionRequest {
  readonly mode: "historical-real-model";
  readonly matchInternalId: string;
  readonly requestId?: string;
  readonly requestedModelVersion?: string;
}

export interface HistoricalMatchMetadata {
  readonly matchInternalId: string;
  readonly scheduledAt: string;
  readonly eventFamily: string;
  readonly eventRegion: string;
  readonly tournamentLevel: string;
  readonly seriesFormat: string;
  readonly teamAProviderId: string;
  readonly teamBProviderId: string;
}

export interface PredictionDataProvenance {
  readonly sourceFeatureDatasetVersion: string;
  readonly featureSchemaVersion: string;
  /** Always `true` for this mode — the prediction was generated from a pre-match snapshot, never live/future data. */
  readonly generatedFromHistoricalSnapshot: true;
}

export interface HistoricalResultAvailability {
  /** Whether the actual historical outcome could be revealed after the prediction is shown. Reveal itself is a future enhancement (see docs/35, "Known limitations") — this only advertises the possibility. */
  readonly actualResultRevealable: boolean;
}

export type PredictedWinnerSide = "teamA" | "teamB";

export interface HistoricalPredictionResponse {
  readonly mode: "historical-real-model";
  readonly requestId?: string;
  readonly match: HistoricalMatchMetadata;
  readonly modelVersion: string;
  readonly estimatorType: string;
  readonly calibrationMethod: string;
  readonly sourceFeatureDatasetVersion: string;
  readonly featureSchemaVersion: string;
  readonly teamAWinProbability: number;
  readonly teamBWinProbability: number;
  readonly predictedWinnerSide: PredictedWinnerSide;
  readonly confidence: number;
  readonly warnings: readonly string[];
  readonly predictionGeneratedAt: string;
  readonly inferenceDurationMs: number;
  readonly dataProvenance: PredictionDataProvenance;
  readonly resultAvailability: HistoricalResultAvailability;
}

export type PredictionErrorCode =
  | "model_unavailable"
  | "model_loading"
  | "historical_data_unavailable"
  | "historical_match_not_found"
  | "feature_dataset_version_mismatch"
  | "feature_row_invalid"
  | "model_version_mismatch"
  | "inference_validation_failed"
  | "inference_failed"
  | "request_invalid"
  | "internal_error"
  | "runtime_package_missing"
  | "runtime_package_manifest_invalid"
  | "runtime_package_hash_mismatch"
  | "runtime_package_version_mismatch"
  | "runtime_package_model_mismatch"
  | "runtime_package_feature_mismatch"
  | "runtime_package_row_count_mismatch"
  | "runtime_package_unsafe_path"
  | "runtime_package_unsupported_target";

export interface PredictionApiErrorPayload {
  readonly code: PredictionErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly requestId?: string;
}

export type ModelRegistryStatus = "unloaded" | "loading" | "ready" | "degraded" | "failed";

/** TASK-048: which data source the real-prediction backend is currently configured to read from. */
export type RealPredictionSourceMode = "local-generated" | "runtime-package";

export interface RealPredictionReadiness {
  readonly realPredictionAvailable: boolean;
  readonly modelStatus: ModelRegistryStatus;
  readonly historicalDataAvailable: boolean;
  readonly currentModelVersion?: string;
  readonly sourceFeatureDatasetVersion?: string;
  readonly message: string;
  readonly retryable: boolean;
  /** TASK-048: which source mode served this readiness snapshot. */
  readonly sourceMode?: RealPredictionSourceMode;
  /** TASK-048: only present when `sourceMode` is `"runtime-package"`. */
  readonly runtimePackageVersion?: string;
}
