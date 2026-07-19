// Configuration
export { loadModelInferenceConfig, describeModelInferenceConfig } from "./config";
export type { ModelInferenceConfig, FallbackPolicy, LoggingMode } from "./config";

// Errors
export { InferenceError, isInferenceError, toSafeError } from "./errors";
export type { InferenceErrorCode, InferenceErrorDetails, SafeInferenceErrorJSON } from "./errors";

// Artifact source
export { LocalFilesystemArtifactSource, APPROVED_ARTIFACT_FILENAMES, INFERENCE_CRITICAL_FILENAMES } from "./artifactSource";
export type { ArtifactSource, ArtifactSourceDescriptor, ArtifactFileStat, ApprovedArtifactFilename } from "./artifactSource";

// Artifact validation
export { validateArtifact, SUPPORTED_ESTIMATOR_TYPES, SUPPORTED_CALIBRATION_METHODS } from "./artifactValidator";
export type { ValidatedArtifactFiles, ArtifactValidationResult, CalibrationMethod } from "./artifactValidator";

// Inference adapter
export { toLoadedModelArtifact, runInference } from "./inferenceAdapter";

// Self-test
export { runSelfTest, buildSelfTestRow } from "./selfTest";
export type { SelfTestReport, SelfTestCheck } from "./selfTest";

// Request/response contracts
export { validateInferenceRequest, assertPayloadSize } from "./requestSchema";
export type { InferenceRequest, ValidatedRequest, FeatureValue } from "./requestSchema";
export { buildInferenceResponse } from "./responseSchema";
export type { InferenceResponse, PredictedWinnerSide, ModelMetadataSummary } from "./responseSchema";

// Registry
export { ModelRegistry } from "./registry";
export type { RegistryStatus, RegistrySnapshot } from "./registry";

// Metrics
export { InferenceMetrics } from "./metrics";
export type { MetricsSnapshot } from "./metrics";

// Health
export { buildLiveness, buildPublicReadiness, buildInternalStatus } from "./health";
export type { LivenessStatus, PublicReadinessStatus, InternalStatus } from "./health";

// Service facade
export { PredictionService, MAX_BATCH_SIZE } from "./predictionService";
export type { BatchItemResult, BatchResult } from "./predictionService";

// Artifact readiness audit
export { runArtifactAudit } from "./audit";
export type { AuditReport, AuditFileEntry } from "./audit";
