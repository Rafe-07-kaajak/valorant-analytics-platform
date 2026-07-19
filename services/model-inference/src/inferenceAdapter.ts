import { predict, type LoadedModelArtifact, type ModelInputRow, type PredictionOutput } from "@repo/vlr-ingestion";
import { InferenceError } from "./errors";
import type { ValidatedArtifactFiles } from "./artifactValidator";

/**
 * Inference adapter — TASK-046 requirement 12. Converts a validated
 * artifact into the exact shape `@repo/vlr-ingestion`'s `predict()` expects
 * and calls it directly. This is the *only* place the service touches
 * model math, and it duplicates none of it: Elo passthrough, logistic
 * regression, gradient-boosted trees, and calibration all remain
 * implemented exactly once, in `services/vlr-ingestion/src/modeling/`.
 */

export function toLoadedModelArtifact(files: ValidatedArtifactFiles): LoadedModelArtifact {
  return {
    model: files.model,
    // `predict()` only reads `preprocessing`/`calibration` structurally
    // (never `eval`s them); the artifact validator has already confirmed
    // both are well-formed JSON with a supported `calibration.method` and
    // finite numeric content.
    preprocessing: files.preprocessing as LoadedModelArtifact["preprocessing"],
    calibration: files.calibration as LoadedModelArtifact["calibration"],
    featureContract: files.featureContract,
    manifest: files.manifest,
  };
}

/** Runs inference through the shared offline predictor, translating any `ModelingError` into this service's own stable `InferenceError` taxonomy. */
export function runInference(artifact: LoadedModelArtifact, row: ModelInputRow): PredictionOutput {
  try {
    return predict(artifact, row);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new InferenceError("inference_failed", `Inference failed: ${message}`, { cause: error });
  }
}
