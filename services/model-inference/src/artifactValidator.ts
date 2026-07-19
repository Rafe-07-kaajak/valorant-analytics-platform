import { contentHashOf, type FeatureContract, type ModelManifest, type SerializedEstimator } from "@repo/vlr-ingestion";
import { InferenceError } from "./errors";
import type { ArtifactSource } from "./artifactSource";
import { INFERENCE_CRITICAL_FILENAMES } from "./artifactSource";
import type { ModelInferenceConfig } from "./config";

/** Mirrors `CalibrationModel["method"]` from `vlr-ingestion/src/modeling/calibration.ts` without importing that internal module directly — the manifest's own `calibrationMethod` field is this service's source of truth for the supported method set. */
export type CalibrationMethod = ModelManifest["calibrationMethod"];
interface CalibrationFile {
  readonly method: CalibrationMethod;
  readonly [key: string]: unknown;
}

/**
 * Artifact validation — TASK-046 requirement 2/4/22. Runs strictly after
 * `ArtifactSource` has already enforced path/symlink safety; this module
 * validates *content*: hashes, cross-file version agreement, estimator/
 * calibration support, and numeric finiteness. Nothing here ever calls
 * `eval`, `Function`, or a dynamic `import()`/`require()` of artifact
 * content — every file is parsed with `JSON.parse` only, so non-JSON
 * (pickled/binary) content fails closed with `artifact_schema_invalid`.
 */

export const SUPPORTED_ESTIMATOR_TYPES: readonly SerializedEstimator["estimatorType"][] = ["elo-baseline", "class-prior-baseline", "constant-baseline", "logistic-regression", "gradient-boosted-trees"];

export const SUPPORTED_CALIBRATION_METHODS: readonly CalibrationMethod[] = ["none", "sigmoid", "isotonic"];

export interface ValidatedArtifactFiles {
  readonly model: SerializedEstimator;
  readonly preprocessing: unknown;
  readonly calibration: CalibrationFile;
  readonly featureContract: FeatureContract;
  readonly manifest: ModelManifest;
}

export interface ArtifactValidationResult {
  readonly files: ValidatedArtifactFiles;
  readonly warnings: readonly string[];
}

function parseJsonFile(fileName: string, raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new InferenceError("artifact_schema_invalid", `Artifact file "${fileName}" is not valid JSON.`, { details: { fileName } });
  }
}

/** Recursively rejects NaN/±Infinity anywhere in an artifact file's parsed content — a corrupt or partially-written numeric model file must never load silently. */
function assertFinite(fileName: string, value: unknown, path = "$"): void {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new InferenceError("artifact_schema_invalid", `Artifact file "${fileName}" contains a non-finite number at ${path}.`, { details: { fileName, path } });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertFinite(fileName, entry, `${path}[${index}]`));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) assertFinite(fileName, entry, `${path}.${key}`);
  }
}

function requireNonEmptyString(fileName: string, field: string, value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InferenceError("artifact_schema_invalid", `Artifact file "${fileName}" is missing required non-empty string field "${field}".`, { details: { fileName, field } });
  }
  return value;
}

async function readAndParse(source: ArtifactSource, fileName: (typeof INFERENCE_CRITICAL_FILENAMES)[number], maxBytes: number): Promise<unknown> {
  const raw = await source.readFile(fileName, maxBytes);
  const parsed = parseJsonFile(fileName, raw);
  assertFinite(fileName, parsed);
  return parsed;
}

/** Loads and validates the 5 inference-critical artifact files. Throws a stable `InferenceError` on the first failure (deterministic, fail-fast validation order: presence -> parse -> finiteness -> cross-file agreement -> support -> hash). */
export async function validateArtifact(source: ArtifactSource, config: ModelInferenceConfig): Promise<ArtifactValidationResult> {
  const present = await source.listFiles();
  const missing = INFERENCE_CRITICAL_FILENAMES.filter((fileName) => !present.includes(fileName));
  if (missing.length > 0) {
    throw new InferenceError("artifact_missing", `Model artifact is missing required file(s): ${missing.join(", ")}.`, { details: { missing } });
  }

  const [model, preprocessing, calibration, featureContract, manifest] = (await Promise.all(INFERENCE_CRITICAL_FILENAMES.map((fileName) => readAndParse(source, fileName, config.maxArtifactFileBytes)))) as [SerializedEstimator, unknown, CalibrationFile, FeatureContract, ModelManifest];

  const warnings: string[] = [];

  requireNonEmptyString("model-manifest.json", "modelVersion", manifest.modelVersion);
  requireNonEmptyString("model-manifest.json", "sourceFeatureDatasetVersion", manifest.sourceFeatureDatasetVersion);

  if (!SUPPORTED_ESTIMATOR_TYPES.includes(manifest.estimatorType)) {
    throw new InferenceError("unsupported_estimator", `Estimator type "${manifest.estimatorType}" is not supported by this service.`, { details: { estimatorType: manifest.estimatorType } });
  }
  if (!SUPPORTED_CALIBRATION_METHODS.includes(manifest.calibrationMethod)) {
    throw new InferenceError("unsupported_calibration", `Calibration method "${manifest.calibrationMethod}" is not supported by this service.`, { details: { calibrationMethod: manifest.calibrationMethod } });
  }

  if (model.estimatorType !== manifest.estimatorType) {
    throw new InferenceError("artifact_schema_invalid", `model.json estimatorType ("${model.estimatorType}") does not match model-manifest.json estimatorType ("${manifest.estimatorType}").`);
  }
  if (calibration.method !== manifest.calibrationMethod) {
    throw new InferenceError("artifact_schema_invalid", `calibration.json method ("${calibration.method}") does not match model-manifest.json calibrationMethod ("${manifest.calibrationMethod}").`);
  }
  if (featureContract.featureSchemaVersion !== manifest.featureSchemaVersion) {
    throw new InferenceError("feature_schema_mismatch", `feature-contract.json featureSchemaVersion ("${featureContract.featureSchemaVersion}") does not match model-manifest.json featureSchemaVersion ("${manifest.featureSchemaVersion}").`);
  }

  if (config.expectedModelVersion && config.expectedModelVersion !== manifest.modelVersion) {
    throw new InferenceError("requested_model_version_mismatch", `Loaded artifact modelVersion "${manifest.modelVersion}" does not match the configured expected model version "${config.expectedModelVersion}".`, { details: { loaded: manifest.modelVersion, expected: config.expectedModelVersion } });
  }
  if (config.expectedFeatureSchemaVersion && config.expectedFeatureSchemaVersion !== featureContract.featureSchemaVersion) {
    throw new InferenceError("feature_schema_mismatch", `Loaded artifact featureSchemaVersion "${featureContract.featureSchemaVersion}" does not match the configured expected feature schema version "${config.expectedFeatureSchemaVersion}".`, { details: { loaded: featureContract.featureSchemaVersion, expected: config.expectedFeatureSchemaVersion } });
  }

  if (config.strictHashValidation) {
    const files: [string, unknown][] = [
      ["model.json", model],
      ["preprocessing.json", preprocessing],
      ["calibration.json", calibration],
      ["feature-contract.json", featureContract],
    ];
    for (const [fileName, parsed] of files) {
      const expected = manifest.contentHashes[fileName];
      if (!expected) {
        warnings.push(`No content hash recorded for "${fileName}" in model-manifest.json; skipped hash verification for this file.`);
        continue;
      }
      const actual = contentHashOf(parsed);
      if (actual !== expected) {
        throw new InferenceError("artifact_hash_mismatch", `Content hash mismatch for "${fileName}": expected "${expected}", computed "${actual}".`, { details: { fileName, expected, actual } });
      }
    }
  } else {
    warnings.push("Strict artifact hash validation is disabled by configuration.");
  }

  return { files: { model, preprocessing, calibration, featureContract, manifest }, warnings };
}
