import { LocalFilesystemArtifactSource, type ArtifactSource } from "./artifactSource";
import { ModelRegistry, type RegistrySnapshot } from "./registry";
import { InferenceMetrics } from "./metrics";
import type { ModelInferenceConfig } from "./config";
import { InferenceError, toSafeError, type SafeInferenceErrorJSON } from "./errors";
import { validateInferenceRequest, assertPayloadSize } from "./requestSchema";
import { runInference } from "./inferenceAdapter";
import { buildInferenceResponse, type InferenceResponse } from "./responseSchema";
import { buildLiveness, buildPublicReadiness, buildInternalStatus, type LivenessStatus, type PublicReadinessStatus, type InternalStatus } from "./health";

/**
 * Service facade — TASK-046 requirement 3/17. This is the single entry
 * point every CLI command and (in a future task) HTTP adapter should call;
 * nothing outside this file should ever reach into the registry, artifact
 * source, or inference adapter directly, so every consumer gets identical
 * validation, error mapping, metrics, and fallback behavior for free.
 */

/** Bounded to keep a single batch call's latency and memory footprint predictable — not currently configurable via environment, since no internal caller has needed anything larger than a small manual batch. */
export const MAX_BATCH_SIZE = 100;

export interface BatchItemResult {
  readonly index: number;
  readonly success: boolean;
  readonly response?: InferenceResponse;
  readonly error?: SafeInferenceErrorJSON;
}

export interface BatchResult {
  readonly results: readonly BatchItemResult[];
  readonly successCount: number;
  readonly failureCount: number;
  readonly totalDurationMs: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class PredictionService {
  readonly registry: ModelRegistry;
  readonly metrics: InferenceMetrics;

  constructor(
    private readonly config: ModelInferenceConfig,
    source?: ArtifactSource,
  ) {
    this.metrics = new InferenceMetrics();
    const artifactSource = source ?? new LocalFilesystemArtifactSource(config.artifactDir);
    this.registry = new ModelRegistry(artifactSource, config, this.metrics);
  }

  /** Startup load — TASK-046 requirement 7. Never throws unless `requireModelOnStart` is set and the load did not end in a ready (or fallback-degraded) state. */
  async start(): Promise<RegistrySnapshot> {
    if (!this.config.loadOnStart) return this.registry.snapshot();
    const snapshot = await this.registry.load();
    if (this.config.requireModelOnStart && !snapshot.ready && !snapshot.fallbackActive) {
      throw new InferenceError("model_unavailable", "Model failed to load on startup and MODEL_INFERENCE_REQUIRE_MODEL_ON_START is enabled.", { details: { lastLoadErrorCode: snapshot.lastLoadError?.code } });
    }
    return snapshot;
  }

  async reload(): Promise<RegistrySnapshot> {
    return this.registry.reload();
  }

  liveness(): LivenessStatus {
    return buildLiveness();
  }

  readiness(): PublicReadinessStatus {
    return buildPublicReadiness(this.registry.snapshot());
  }

  internalStatus(): InternalStatus {
    return buildInternalStatus(this.registry.snapshot(), this.metrics.snapshot());
  }

  private buildFallbackResponse(request: unknown): InferenceResponse {
    const requestId = isPlainObject(request) && typeof request.requestId === "string" ? request.requestId : undefined;
    const p = this.config.fallbackConstantProbability;
    return {
      requestId,
      modelVersion: "fallback-constant",
      sourceFeatureDatasetVersion: "none",
      featureSchemaVersion: "none",
      estimatorType: "fallback-constant",
      calibrationMethod: "none",
      teamAWinProbability: p,
      teamBWinProbability: 1 - p,
      predictedWinnerSide: p >= 0.5 ? "teamA" : "teamB",
      confidence: 0,
      predictionGeneratedAt: new Date().toISOString(),
      inferenceDurationMs: 0,
      warnings: ["FALLBACK MODE ACTIVE: no trained model artifact is loaded. This response is a constant configured fallback probability (MODEL_INFERENCE_FALLBACK_CONSTANT_PROBABILITY), not a real model prediction."],
      modelMetadata: { modelVersion: "fallback-constant", estimatorType: "fallback-constant", calibrationMethod: "none", sourceFeatureDatasetVersion: "none", featureSchemaVersion: "none" },
    };
  }

  /** Single-request prediction — TASK-046 requirement 8/9/17. `rawBody`, if provided, is checked against the configured payload-size bound before the request is inspected at all. */
  async predict(request: unknown, rawBody?: string): Promise<InferenceResponse> {
    if (rawBody !== undefined) assertPayloadSize(rawBody, this.config);

    const snapshot = this.registry.snapshot();
    const artifact = this.registry.getCurrentArtifact();

    if (!artifact) {
      if (snapshot.fallbackActive) return this.buildFallbackResponse(request);
      const code = snapshot.status === "loading" ? "model_loading" : "model_not_loaded";
      this.metrics.recordInferenceFailure(code);
      throw new InferenceError(code, "No model is currently loaded; cannot serve a prediction.", { details: { registryStatus: snapshot.status } });
    }

    let validated;
    try {
      validated = validateInferenceRequest(request, artifact.featureContract);
      if (validated.requestedModelVersion && validated.requestedModelVersion !== artifact.manifest.modelVersion) {
        throw new InferenceError("requested_model_version_mismatch", `Requested model version "${validated.requestedModelVersion}" does not match the currently loaded version "${artifact.manifest.modelVersion}".`, { details: { requested: validated.requestedModelVersion, loaded: artifact.manifest.modelVersion } });
      }
    } catch (error) {
      this.metrics.recordInferenceFailure(toSafeError(error).code);
      throw error;
    }

    const start = performance.now();
    let prediction;
    try {
      prediction = runInference(artifact, validated.row);
    } catch (error) {
      const safe = toSafeError(error);
      this.metrics.recordInferenceFailure(safe.code);
      throw error;
    }
    const durationMs = performance.now() - start;

    // Post-hoc timeout guard: inference here is synchronous in-process
    // arithmetic (no I/O, no network), so there is nothing to preempt
    // mid-flight — this detects and reports a budget breach rather than
    // cancelling a hung call, which is the honest capability of a
    // single-threaded synchronous computation.
    if (durationMs > this.config.inferenceTimeoutMs) {
      this.metrics.recordInferenceFailure("inference_timeout");
      throw new InferenceError("inference_timeout", `Inference took ${durationMs.toFixed(1)}ms, exceeding the configured budget of ${this.config.inferenceTimeoutMs}ms.`, { details: { elapsedMs: durationMs } });
    }

    this.metrics.recordInferenceSuccess(durationMs);
    return buildInferenceResponse({
      requestId: validated.requestId,
      prediction,
      manifest: artifact.manifest,
      featureSchemaVersion: artifact.featureContract.featureSchemaVersion,
      inferenceDurationMs: durationMs,
      warnings: validated.warnings,
      now: () => new Date(),
    });
  }

  /** Bounded internal batch method — TASK-046 requirement 14. Preserves input order; each item fails independently (documented per-item error policy) rather than aborting the whole batch. Not exposed over any public route. */
  async predictBatch(requests: readonly unknown[]): Promise<BatchResult> {
    if (requests.length > MAX_BATCH_SIZE) {
      throw new InferenceError("payload_too_large", `Batch size ${requests.length} exceeds the maximum of ${MAX_BATCH_SIZE}.`, { details: { batchSize: requests.length, maxBatchSize: MAX_BATCH_SIZE } });
    }
    const start = performance.now();
    const results: BatchItemResult[] = [];
    let successCount = 0;
    let failureCount = 0;
    for (let index = 0; index < requests.length; index += 1) {
      try {
        const response = await this.predict(requests[index]);
        results.push({ index, success: true, response });
        successCount += 1;
      } catch (error) {
        results.push({ index, success: false, error: toSafeError(error) });
        failureCount += 1;
      }
    }
    return { results, successCount, failureCount, totalDurationMs: performance.now() - start };
  }
}
