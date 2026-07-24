import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeModelArtifact, MODEL_DIR_SEGMENTS, contentHashOf, type ModelArtifactFiles, type FeatureContract, type ModelManifest, type SerializedEstimator } from "@repo/vlr-ingestion";

/**
 * Test-only fixture builder — TASK-046 requirement 25 ("use fixtures for
 * tests, not the developer's gitignored real model directory"). Reuses
 * `@repo/vlr-ingestion`'s own `writeModelArtifact` so every fixture is
 * written through the exact same serialization path as a real
 * `pnpm ingest:vlr:model:train` run, rather than a hand-rolled duplicate.
 */

export const FIXTURE_NUMERIC_FIELDS = ["teamAEloWinProbability", "teamAEloRating", "teamBEloRating", "teamADaysSinceLastMatch"] as const;
export const FIXTURE_NULLABLE_NUMERIC_FIELDS = ["teamADaysSinceLastMatch"] as const;
export const FIXTURE_BOOLEAN_FIELDS = ["teamAHasPriorMatch"] as const;
export const FIXTURE_CATEGORICAL_FIELDS = ["eventFamily"] as const;
export const FIXTURE_CATEGORICAL_VOCABULARY = { eventFamily: ["vct-americas", "masters"] };
export const FIXTURE_ENCODED_FEATURE_NAMES = ["teamAEloWinProbability", "teamAEloRating", "teamBEloRating", "teamADaysSinceLastMatch", "teamADaysSinceLastMatch__isMissing", "teamAHasPriorMatch", "eventFamily=vct-americas", "eventFamily=masters", "eventFamily=__unknown__"] as const;

export const FIXTURE_FEATURE_CONTRACT: FeatureContract = {
  featureSchemaVersion: "fixture-feature-schema@1.0.0",
  featureRulesVersion: "fixture-feature-rules@1.0.0",
  numericFields: [...FIXTURE_NUMERIC_FIELDS],
  nullableNumericFields: [...FIXTURE_NULLABLE_NUMERIC_FIELDS],
  booleanFields: [...FIXTURE_BOOLEAN_FIELDS],
  categoricalFields: [...FIXTURE_CATEGORICAL_FIELDS],
  categoricalVocabulary: FIXTURE_CATEGORICAL_VOCABULARY,
  encodedFeatureNames: [...FIXTURE_ENCODED_FEATURE_NAMES],
  excludedFields: ["matchInternalId", "labelTeamAWin", "teamAProviderId"],
  requiredInputFields: [...FIXTURE_NUMERIC_FIELDS, ...FIXTURE_BOOLEAN_FIELDS, ...FIXTURE_CATEGORICAL_FIELDS],
  outputSchema: { teamAWinProbability: "number in [0, 1]", teamBWinProbability: "number in [0, 1]" },
};

function fixturePreprocessing() {
  const meanByField: Record<string, number> = {};
  const medianByField: Record<string, number> = {};
  const stdByField: Record<string, number> = {};
  for (const field of FIXTURE_NUMERIC_FIELDS) {
    meanByField[field] = 0;
    medianByField[field] = 0;
    stdByField[field] = 1;
  }
  return {
    numericFields: [...FIXTURE_NUMERIC_FIELDS],
    nullableNumericFields: [...FIXTURE_NULLABLE_NUMERIC_FIELDS],
    booleanFields: [...FIXTURE_BOOLEAN_FIELDS],
    categoricalFields: [...FIXTURE_CATEGORICAL_FIELDS],
    medianByField,
    meanByField,
    stdByField,
    vocabularyByField: FIXTURE_CATEGORICAL_VOCABULARY,
    featureNames: [...FIXTURE_ENCODED_FEATURE_NAMES],
  };
}

function fixtureManifest(overrides: Partial<ModelManifest> = {}): ModelManifest {
  return {
    modelVersion: "fixture-model-v1",
    modelingRulesVersion: "vlr-modeling-rules@1.0.0",
    sourceFeatureDatasetVersion: "fixture-source-v1",
    featureSchemaVersion: FIXTURE_FEATURE_CONTRACT.featureSchemaVersion,
    featureRulesVersion: FIXTURE_FEATURE_CONTRACT.featureRulesVersion,
    estimatorType: "elo-baseline",
    calibrationMethod: "none",
    randomSeed: 45045,
    trainRowCount: 10,
    validationRowCount: 2,
    testRowCount: 2,
    trainDateRangeStartIso: "2025-01-01T00:00:00.000Z",
    trainDateRangeEndIso: "2025-06-01T00:00:00.000Z",
    reportingThreshold: 0.5,
    probabilityClippingEpsilon: 1e-15,
    nodeRuntimeVersion: process.version,
    typescriptVersion: "5.0.0",
    generatedAt: "2026-01-01T00:00:00.000Z",
    selectionRationale: "fixture",
    contentHashes: {},
    ...overrides,
  };
}

function reportingFiles(): Pick<ModelArtifactFiles, "model-card.json" | "evaluation.json" | "test-predictions.json" | "fold-predictions.json" | "reliability-data.json" | "feature-importance.json"> {
  const zeroMetrics = { logLoss: 0, brierScore: 0, rocAuc: null, accuracy: 0, balancedAccuracy: 0, precision: 0, recall: 0, f1: 0, expectedCalibrationError: 0, calibrationSlopeIntercept: null, averagePredictedProbability: 0, predictionSharpness: 0, positiveRate: 0, sampleCount: 0 };
  return {
    "model-card.json": { summary: "fixture", datasetSummary: {}, candidatesEvaluated: [], backtestSummary: {}, calibrationSummary: {}, selectionRationale: "fixture", finalTestSummary: {}, knownLimitations: [], nextStep: "fixture" },
    "evaluation.json": {
      baselineTestMetrics: {},
      validationMetrics: zeroMetrics,
      walkForward: { meanLogLoss: 0, medianLogLoss: 0, meanBrierScore: 0, pooledMetrics: zeroMetrics, folds: [] },
      testMetricsUncalibrated: zeroMetrics,
      testMetricsCalibrated: zeroMetrics,
      uncertainty: {
        logLoss: { point: 0, lowerP2_5: 0, upperP97_5: 0, iterations: 0, seed: 0 },
        brierScore: { point: 0, lowerP2_5: 0, upperP97_5: 0, iterations: 0, seed: 0 },
        accuracy: { point: 0, lowerP2_5: 0, upperP97_5: 0, iterations: 0, seed: 0 },
        logLossMinusElo: { point: 0, lowerP2_5: 0, upperP97_5: 0, iterations: 0, seed: 0 },
        brierScoreMinusElo: { point: 0, lowerP2_5: 0, upperP97_5: 0, iterations: 0, seed: 0 },
      },
    },
    "test-predictions.json": [],
    "fold-predictions.json": [],
    "reliability-data.json": { preCalibration: [], postCalibration: [] },
    "feature-importance.json": { method: "standardized-coefficient", topPositive: [], topNegative: [], unstableFeatures: [], zeroOrUnusedFeatures: [], caveat: "fixture" },
  };
}

export interface FixtureArtifactOptions {
  readonly model: SerializedEstimator;
  readonly manifestOverrides?: Partial<ModelManifest>;
  /** Overrides fields of `FIXTURE_FEATURE_CONTRACT` — e.g. a caller that constructs its own real-shaped feature row (not `fixtureValidRow()`) needs the artifact to declare a matching `featureSchemaVersion`/`featureRulesVersion` rather than the fixture's own default strings. */
  readonly featureContractOverrides?: Partial<FeatureContract>;
  /** Deliberately breaks a content hash to exercise `artifact_hash_mismatch` — TASK-046 requirement 24. */
  readonly corruptModelJsonAfterHashing?: boolean;
  /** Omits a required file to exercise `artifact_missing`. */
  readonly omitFile?: keyof ModelArtifactFiles;
}

export interface FixtureArtifact {
  readonly rootDir: string;
  readonly artifactDir: string;
}

/** Writes a complete, valid (unless deliberately corrupted) fixture artifact into a fresh temp directory and returns the resolved `artifactDir` a `LocalFilesystemArtifactSource` should point at. */
export async function buildFixtureArtifact(options: FixtureArtifactOptions): Promise<FixtureArtifact> {
  const rootDir = await mkdtemp(join(tmpdir(), "model-inference-fixture-"));
  const preprocessing = fixturePreprocessing();
  const calibration = { method: "none" as const };
  const featureContract: FeatureContract = { ...FIXTURE_FEATURE_CONTRACT, ...options.featureContractOverrides };

  const files: ModelArtifactFiles = {
    "model.json": options.model,
    "preprocessing.json": preprocessing,
    "calibration.json": calibration,
    "feature-contract.json": featureContract,
    "model-manifest.json": fixtureManifest({
      estimatorType: options.model.estimatorType,
      featureSchemaVersion: featureContract.featureSchemaVersion,
      featureRulesVersion: featureContract.featureRulesVersion,
      ...options.manifestOverrides,
    }),
    ...reportingFiles(),
  };

  if (options.omitFile) {
    const draft = { ...files };
    delete draft[options.omitFile];
    const hashes: Record<string, string> = {};
    for (const [fileName, value] of Object.entries(draft)) hashes[fileName] = contentHashOf(value);
    const manifestWithHashes = { ...draft["model-manifest.json"], contentHashes: hashes } as ModelManifest;
    await writeModelArtifact(rootDir, { ...draft, "model-manifest.json": manifestWithHashes } as ModelArtifactFiles);
  } else {
    const hashes: Record<string, string> = {};
    for (const [fileName, value] of Object.entries(files)) hashes[fileName] = contentHashOf(value);
    const manifestWithHashes = { ...files["model-manifest.json"], contentHashes: hashes };
    await writeModelArtifact(rootDir, { ...files, "model-manifest.json": manifestWithHashes });
  }

  const artifactDir = join(rootDir, ...MODEL_DIR_SEGMENTS);

  if (options.corruptModelJsonAfterHashing) {
    // Rewrite model.json with different content *after* hashes were computed
    // from the original — simulates on-disk corruption/tampering, which
    // strict hash validation must catch. `estimatorType` is deliberately
    // preserved so this exercises the hash check specifically, not the
    // (separately-tested) model/manifest estimator-agreement check.
    const { writeFile } = await import("node:fs/promises");
    await writeFile(join(artifactDir, "model.json"), JSON.stringify({ ...options.model, tamperedField: true }), "utf-8");
  }

  return { rootDir, artifactDir };
}

export const ELO_FIXTURE_MODEL: SerializedEstimator = { estimatorType: "elo-baseline" };

export const LOGISTIC_FIXTURE_MODEL: SerializedEstimator = {
  estimatorType: "logistic-regression",
  weights: [1, 0, 0, 0, 0, 0, 0, 0, 0],
  bias: 0,
  featureNames: [...FIXTURE_ENCODED_FEATURE_NAMES],
  config: { l2Lambda: 0.01, iterations: 1, learningRate: 0.01 },
};

export const TREE_FIXTURE_MODEL: SerializedEstimator = {
  estimatorType: "gradient-boosted-trees",
  trees: [{ isLeaf: false, featureIndex: 0, threshold: 0, left: { isLeaf: true, value: -2, sampleCount: 1 }, right: { isLeaf: true, value: 2, sampleCount: 1 } }],
  initialLogOdds: 0,
  featureNames: [...FIXTURE_ENCODED_FEATURE_NAMES],
  config: { maxDepth: 1, learningRate: 1, numTrees: 1, minSamplesLeaf: 1 },
};

export function fixtureValidRow(): Record<string, string | number | boolean> {
  return {
    teamAEloWinProbability: 0.62,
    teamAEloRating: 1550,
    teamBEloRating: 1480,
    teamADaysSinceLastMatch: 5,
    teamAHasPriorMatch: true,
    eventFamily: "vct-americas",
  };
}
