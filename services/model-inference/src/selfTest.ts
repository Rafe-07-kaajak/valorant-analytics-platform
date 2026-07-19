import type { FeatureContract, LoadedModelArtifact, ModelInputRow } from "@repo/vlr-ingestion";
import { InferenceError } from "./errors";
import { runInference } from "./inferenceAdapter";

/**
 * Deterministic startup self-test — TASK-046 requirement 7. Uses a
 * synthetic, artifact-contract-shaped row built entirely from the loaded
 * `feature-contract.json` (never the real TASK-044 feature dataset), so the
 * self-test has zero runtime dependency on `services/vlr-ingestion`'s local
 * feature files being present. The registry only transitions to `ready`
 * after every check below passes.
 */

const PROBABILITY_SUM_TOLERANCE = 1e-9;

/** Builds a structurally valid, deterministic row from the artifact's own feature contract — every numeric field is `0`, every boolean is `false`, every categorical field takes its first training-vocabulary value (falling back to the artifact's own "__unknown__" bucket if a field somehow has an empty vocabulary). */
export function buildSelfTestRow(featureContract: FeatureContract): ModelInputRow {
  const row: Record<string, string | number | boolean> = {};
  for (const field of featureContract.numericFields) row[field] = 0;
  for (const field of featureContract.booleanFields) row[field] = false;
  for (const field of featureContract.categoricalFields) {
    const vocabulary = featureContract.categoricalVocabulary[field];
    row[field] = vocabulary && vocabulary.length > 0 ? vocabulary[0]! : "__unknown__";
  }
  return row;
}

export interface SelfTestCheck {
  readonly name: string;
  readonly passed: boolean;
  readonly detail?: string;
}

export interface SelfTestReport {
  readonly passed: boolean;
  readonly checks: readonly SelfTestCheck[];
  readonly teamAWinProbability: number | null;
  readonly durationMs: number;
}

/** Runs the full self-test and throws `self_test_failed` on the first failing check (never partially "passes" the registry). */
export function runSelfTest(artifact: LoadedModelArtifact, now: () => number = () => Date.now()): SelfTestReport {
  const start = now();
  const checks: SelfTestCheck[] = [];
  let teamAWinProbability: number | null = null;

  const row = buildSelfTestRow(artifact.featureContract);

  let first;
  try {
    first = runInference(artifact, row);
    checks.push({ name: "prediction_succeeds", passed: true });
  } catch (error) {
    checks.push({ name: "prediction_succeeds", passed: false, detail: error instanceof Error ? error.message : String(error) });
    throw new InferenceError("self_test_failed", "Self-test failed: the loaded artifact could not produce a prediction for a valid known-shaped input.", { cause: error });
  }

  teamAWinProbability = first.teamAWinProbability;

  const finite = Number.isFinite(first.teamAWinProbability) && Number.isFinite(first.teamBWinProbability);
  checks.push({ name: "probabilities_finite", passed: finite });
  if (!finite) throw new InferenceError("self_test_failed", "Self-test failed: the loaded artifact produced a non-finite probability.");

  const inRange = first.teamAWinProbability >= 0 && first.teamAWinProbability <= 1 && first.teamBWinProbability >= 0 && first.teamBWinProbability <= 1;
  checks.push({ name: "probabilities_in_range", passed: inRange });
  if (!inRange) throw new InferenceError("self_test_failed", "Self-test failed: a probability fell outside [0, 1].");

  const sumsToOne = Math.abs(first.teamAWinProbability + first.teamBWinProbability - 1) <= PROBABILITY_SUM_TOLERANCE;
  checks.push({ name: "probabilities_sum_to_one", passed: sumsToOne });
  if (!sumsToOne) throw new InferenceError("self_test_failed", "Self-test failed: teamAWinProbability + teamBWinProbability did not sum to 1 within tolerance.");

  const second = runInference(artifact, row);
  const deterministic = second.teamAWinProbability === first.teamAWinProbability && second.teamBWinProbability === first.teamBWinProbability;
  checks.push({ name: "repeated_prediction_deterministic", passed: deterministic });
  if (!deterministic) throw new InferenceError("self_test_failed", "Self-test failed: repeated predictions on the same input were not identical.");

  const versionPresent = typeof artifact.manifest.modelVersion === "string" && artifact.manifest.modelVersion.length > 0;
  checks.push({ name: "model_version_present", passed: versionPresent });
  if (!versionPresent) throw new InferenceError("self_test_failed", "Self-test failed: loaded artifact has no modelVersion.");

  return { passed: true, checks, teamAWinProbability, durationMs: now() - start };
}
