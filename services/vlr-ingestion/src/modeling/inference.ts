import type { FeatureRow } from "../feature/types";
import { ModelingError } from "./errors";
import { transformSingleRow } from "./preprocessing";
import { applyCalibration } from "./calibration";
import { predictLogisticRegressionSingle } from "./logisticRegression";
import { predictGradientBoostedTreesSingle } from "./gradientBoostedTrees";
import type { LoadedModelArtifact } from "./artifact";

/**
 * Offline artifact-based predictor — TASK-045 requirement 18. Foundation
 * for TASK-046, but not itself a production service: it never listens on a
 * port, never makes a network request, and is exercised only by this
 * task's own tests and the `model:predict` CLI command. Loads a previously
 * written artifact, validates the input row against the artifact's own
 * feature contract, applies the *frozen* preprocessing/calibration
 * unchanged, and returns both teams' win probabilities.
 */

export type ModelInputRow = Readonly<Record<string, string | number | boolean | null>>;

export interface PredictionOutput {
  readonly teamAWinProbability: number;
  readonly teamBWinProbability: number;
}

function validateInputRow(row: ModelInputRow, requiredFields: readonly string[]): void {
  for (const field of requiredFields) {
    if (!(field in row)) {
      throw new ModelingError("input_validation_failed", `Missing required feature "${field}".`);
    }
    const value = row[field];
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new ModelingError("input_validation_failed", `Feature "${field}" is NaN or Infinite.`);
    }
  }
}

function clampProbability(p: number): number {
  return Math.min(1, Math.max(0, p));
}

/** Runs inference for a single pre-match feature row against a loaded artifact. Deterministic: an identical row always produces an identical prediction (TASK-045 requirement 21, "same feature row gives identical artifact prediction"). */
export function predict(artifact: LoadedModelArtifact, row: ModelInputRow): PredictionOutput {
  const model = artifact.model;
  let rawProbability: number;

  if (model.estimatorType === "elo-baseline") {
    const value = row.teamAEloWinProbability;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new ModelingError("input_validation_failed", 'Missing/invalid required feature "teamAEloWinProbability".');
    }
    rawProbability = value;
  } else if (model.estimatorType === "class-prior-baseline") {
    rawProbability = model.prior;
  } else if (model.estimatorType === "constant-baseline") {
    rawProbability = model.value;
  } else {
    validateInputRow(row, artifact.featureContract.requiredInputFields);
    const encoded = transformSingleRow(row as unknown as FeatureRow, artifact.preprocessing);
    rawProbability = model.estimatorType === "logistic-regression" ? predictLogisticRegressionSingle(model, encoded) : predictGradientBoostedTreesSingle(model, encoded);
  }

  const calibrated = clampProbability(applyCalibration(artifact.calibration, rawProbability));
  return { teamAWinProbability: calibrated, teamBWinProbability: 1 - calibrated };
}
