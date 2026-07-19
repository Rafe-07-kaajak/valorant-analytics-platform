import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";
import { resolveSafePath } from "../persistence/pathSafety";
import { stableStringify } from "../curate/curatedExport";
import { ModelingError } from "./errors";
import { contentHashOf } from "./modelVersion";
import type { LogisticRegressionConfig } from "./logisticRegression";
import type { GradientBoostedTreesConfig } from "./gradientBoostedTrees";
import type { TreeNode } from "./regressionTree";
import type { PreprocessorState } from "./preprocessing";
import type { CalibrationModel } from "./calibration";
import type { ProbabilisticMetrics, ReliabilityBin } from "./metrics";
import type { TestSetUncertainty } from "./bootstrap";

/**
 * The TASK-046-facing model artifact contract — TASK-045 requirement 15/16.
 * Every file is plain, stably-serialized JSON (no pickle, no binary
 * blobs, no framework-specific format) so it is directly loadable from the
 * repository's Node service environment without a Python runtime — the
 * same portability requirement TASK-046 will depend on.
 */

export const MODEL_DIR_SEGMENTS = ["models", "selected-model"] as const;

export type SerializedEstimator =
  | { readonly estimatorType: "logistic-regression"; readonly weights: readonly number[]; readonly bias: number; readonly featureNames: readonly string[]; readonly config: LogisticRegressionConfig }
  | { readonly estimatorType: "gradient-boosted-trees"; readonly trees: readonly TreeNode[]; readonly initialLogOdds: number; readonly featureNames: readonly string[]; readonly config: GradientBoostedTreesConfig }
  | { readonly estimatorType: "elo-baseline" }
  | { readonly estimatorType: "class-prior-baseline"; readonly prior: number }
  | { readonly estimatorType: "constant-baseline"; readonly value: number };

export interface FeatureContract {
  readonly featureSchemaVersion: string;
  readonly featureRulesVersion: string;
  readonly numericFields: readonly string[];
  readonly nullableNumericFields: readonly string[];
  readonly booleanFields: readonly string[];
  readonly categoricalFields: readonly string[];
  readonly categoricalVocabulary: Readonly<Record<string, readonly string[]>>;
  readonly encodedFeatureNames: readonly string[];
  readonly excludedFields: readonly string[];
  readonly requiredInputFields: readonly string[];
  readonly outputSchema: { readonly teamAWinProbability: string; readonly teamBWinProbability: string };
}

export interface ModelManifest {
  readonly modelVersion: string;
  readonly modelingRulesVersion: string;
  readonly sourceFeatureDatasetVersion: string;
  readonly featureSchemaVersion: string;
  readonly featureRulesVersion: string;
  readonly estimatorType: SerializedEstimator["estimatorType"];
  readonly calibrationMethod: CalibrationModel["method"];
  readonly randomSeed: number;
  readonly trainRowCount: number;
  readonly validationRowCount: number;
  readonly testRowCount: number;
  readonly trainDateRangeStartIso: string | null;
  readonly trainDateRangeEndIso: string | null;
  readonly reportingThreshold: number;
  readonly probabilityClippingEpsilon: number;
  readonly nodeRuntimeVersion: string;
  readonly typescriptVersion: string;
  readonly generatedAt: string;
  readonly selectionRationale: string;
  readonly contentHashes: Readonly<Record<string, string>>;
}

export interface ModelCard {
  readonly summary: string;
  readonly datasetSummary: Readonly<Record<string, unknown>>;
  readonly candidatesEvaluated: readonly Readonly<Record<string, unknown>>[];
  readonly backtestSummary: Readonly<Record<string, unknown>>;
  readonly calibrationSummary: Readonly<Record<string, unknown>>;
  readonly selectionRationale: string;
  readonly finalTestSummary: Readonly<Record<string, unknown>>;
  readonly knownLimitations: readonly string[];
  readonly nextStep: string;
}

export interface FoldSummary {
  readonly foldId: number;
  readonly trainRowCount: number;
  readonly validationRowCount: number;
  readonly trainStartIso: string | null;
  readonly trainEndIso: string | null;
  readonly validationStartIso: string | null;
  readonly validationEndIso: string | null;
  readonly metrics: ProbabilisticMetrics;
}

export interface EvaluationReport {
  readonly baselineTestMetrics: Readonly<Record<string, ProbabilisticMetrics>>;
  readonly validationMetrics: ProbabilisticMetrics;
  readonly walkForward: {
    readonly meanLogLoss: number;
    readonly medianLogLoss: number;
    readonly meanBrierScore: number;
    readonly pooledMetrics: ProbabilisticMetrics;
    readonly folds: readonly FoldSummary[];
  };
  readonly testMetricsUncalibrated: ProbabilisticMetrics;
  readonly testMetricsCalibrated: ProbabilisticMetrics;
  readonly uncertainty: TestSetUncertainty;
}

export interface RowPrediction {
  readonly matchInternalId: string;
  readonly predictedRaw: number;
  readonly predictedCalibrated: number;
  readonly actual: number;
}

export interface FoldPredictionRecord {
  readonly foldId: number;
  readonly predictions: readonly { readonly matchInternalId: string; readonly predicted: number; readonly actual: number }[];
}

export interface ReliabilityData {
  readonly preCalibration: readonly ReliabilityBin[];
  readonly postCalibration: readonly ReliabilityBin[];
}

export interface FeatureImportanceEntry {
  readonly feature: string;
  readonly value: number;
  readonly direction: "positive" | "negative" | "neutral";
}

export interface FeatureImportanceReport {
  readonly method: "standardized-coefficient" | "permutation-importance";
  readonly topPositive: readonly FeatureImportanceEntry[];
  readonly topNegative: readonly FeatureImportanceEntry[];
  readonly unstableFeatures: readonly string[];
  readonly zeroOrUnusedFeatures: readonly string[];
  readonly caveat: string;
}

export interface ModelArtifactFiles {
  readonly "model.json": SerializedEstimator;
  readonly "preprocessing.json": PreprocessorState;
  readonly "calibration.json": CalibrationModel;
  readonly "feature-contract.json": FeatureContract;
  readonly "model-manifest.json": ModelManifest;
  readonly "model-card.json": ModelCard;
  readonly "evaluation.json": EvaluationReport;
  readonly "test-predictions.json": readonly RowPrediction[];
  readonly "fold-predictions.json": readonly FoldPredictionRecord[];
  readonly "reliability-data.json": ReliabilityData;
  readonly "feature-importance.json": FeatureImportanceReport;
}

async function writeFileAtomic(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${randomBytes(6).toString("hex")}`;
  await writeFile(tempPath, content, "utf-8");
  await rename(tempPath, filePath);
}

/** Writes every artifact file under `<dataDir>/models/selected-model/`. Returns each file's content hash for idempotency/parity verification. */
export async function writeModelArtifact(dataDir: string, files: ModelArtifactFiles): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  for (const [fileName, value] of Object.entries(files)) {
    const path = resolveSafePath(dataDir, ...MODEL_DIR_SEGMENTS, fileName);
    await writeFileAtomic(path, stableStringify(value));
    hashes[fileName] = contentHashOf(value);
  }
  return hashes;
}

async function readJson<T>(dataDir: string, fileName: string): Promise<T> {
  const path = resolveSafePath(dataDir, ...MODEL_DIR_SEGMENTS, fileName);
  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch {
    throw new ModelingError("artifact_not_found", `Model artifact file "${fileName}" not found under "${dataDir}/${MODEL_DIR_SEGMENTS.join("/")}/". Run \`pnpm ingest:vlr:model:train\` first.`);
  }
  return JSON.parse(raw) as T;
}

export interface LoadedModelArtifact {
  readonly model: SerializedEstimator;
  readonly preprocessing: PreprocessorState;
  readonly calibration: CalibrationModel;
  readonly featureContract: FeatureContract;
  readonly manifest: ModelManifest;
}

/** Loads the artifact files needed for inference (`inference.ts`) — never the report/diagnostic files, which are read-only reporting output. */
export async function loadModelArtifactForInference(dataDir: string): Promise<LoadedModelArtifact> {
  const [model, preprocessing, calibration, featureContract, manifest] = await Promise.all([
    readJson<SerializedEstimator>(dataDir, "model.json"),
    readJson<PreprocessorState>(dataDir, "preprocessing.json"),
    readJson<CalibrationModel>(dataDir, "calibration.json"),
    readJson<FeatureContract>(dataDir, "feature-contract.json"),
    readJson<ModelManifest>(dataDir, "model-manifest.json"),
  ]);
  return { model, preprocessing, calibration, featureContract, manifest };
}

export async function readArtifactFile<K extends keyof ModelArtifactFiles>(dataDir: string, fileName: K): Promise<ModelArtifactFiles[K]> {
  return readJson<ModelArtifactFiles[K]>(dataDir, fileName);
}
