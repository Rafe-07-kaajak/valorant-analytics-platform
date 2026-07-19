import { contentHashOf, type FeatureContract, type ModelManifest, type SerializedEstimator } from "@repo/vlr-ingestion";
import { LocalFilesystemArtifactSource, INFERENCE_CRITICAL_FILENAMES } from "../artifactSource";
import { validateArtifact } from "../artifactValidator";
import type { ModelInferenceConfig } from "../config";
import { RuntimePackageError } from "./runtimePackageErrors";
import type { RuntimePackageFileEntry } from "./runtimePackageTypes";

/**
 * Reads and validates the source model artifact's 5 inference-critical
 * files for packaging — TASK-048. Reuses `validateArtifact` (the same
 * hash/cross-file-agreement validation the live inference service runs at
 * load time) rather than re-implementing artifact parsing, so a runtime
 * package can only ever be built from an artifact that already passes the
 * exact same checks the service itself would apply.
 */

export interface ModelExportResult {
  readonly model: SerializedEstimator;
  readonly preprocessing: unknown;
  readonly calibration: unknown;
  readonly featureContract: FeatureContract;
  readonly manifest: ModelManifest;
  readonly files: readonly RuntimePackageFileEntry[];
  readonly warnings: readonly string[];
}

/** Builds a minimal, fully-populated `ModelInferenceConfig` for `validateArtifact`'s purposes only — packaging always validates with strict hashing and no version pin, independent of the deployed inference service's own env-derived config. */
function buildValidationConfig(maxFileBytes: number): ModelInferenceConfig {
  return {
    artifactDir: "", // unused: this module constructs its own ArtifactSource directly
    expectedModelVersion: undefined,
    expectedFeatureSchemaVersion: undefined,
    loadOnStart: false,
    requireModelOnStart: false,
    strictHashValidation: true,
    probabilityClipEpsilon: 1e-15,
    maxRequestBytes: 262_144,
    reloadEnabled: false,
    reloadIntervalMs: undefined,
    fallbackPolicy: "disabled",
    fallbackConstantProbability: 0.5,
    inferenceTimeoutMs: 5_000,
    loggingMode: "safe",
    maxArtifactFileBytes: maxFileBytes,
  };
}

export async function exportModelArtifact(sourceModelDir: string, maxFileBytes: number): Promise<ModelExportResult> {
  const source = new LocalFilesystemArtifactSource(sourceModelDir);
  const config = buildValidationConfig(maxFileBytes);

  let result;
  try {
    result = await validateArtifact(source, config);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown artifact validation failure.";
    throw new RuntimePackageError("runtime_package_build_failed", `Source model artifact failed validation: ${message}`);
  }

  const files: RuntimePackageFileEntry[] = [];
  for (const fileName of INFERENCE_CRITICAL_FILENAMES) {
    const stat = await source.statFile(fileName);
    const parsed =
      fileName === "model.json"
        ? result.files.model
        : fileName === "preprocessing.json"
          ? result.files.preprocessing
          : fileName === "calibration.json"
            ? result.files.calibration
            : fileName === "feature-contract.json"
              ? result.files.featureContract
              : result.files.manifest;
    files.push({ fileName, sha256: contentHashOf(parsed), sizeBytes: stat.sizeBytes });
  }

  return {
    model: result.files.model,
    preprocessing: result.files.preprocessing,
    calibration: result.files.calibration,
    featureContract: result.files.featureContract,
    manifest: result.files.manifest,
    files,
    warnings: result.warnings,
  };
}
