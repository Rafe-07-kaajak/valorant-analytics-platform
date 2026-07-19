import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadModelArtifactForInference, writeModelArtifact, type ModelArtifactFiles } from "./artifact";
import { ModelingError } from "./errors";

function baseFiles(overrides: Partial<ModelArtifactFiles> = {}): ModelArtifactFiles {
  return {
    "model.json": { estimatorType: "constant-baseline", value: 0.5 },
    "preprocessing.json": { numericFields: [], nullableNumericFields: [], booleanFields: [], categoricalFields: [], medianByField: {}, meanByField: {}, stdByField: {}, vocabularyByField: {}, featureNames: [] },
    "calibration.json": { method: "none" },
    "feature-contract.json": {
      featureSchemaVersion: "v1",
      featureRulesVersion: "v1",
      numericFields: [],
      nullableNumericFields: [],
      booleanFields: [],
      categoricalFields: [],
      categoricalVocabulary: {},
      encodedFeatureNames: [],
      excludedFields: [],
      requiredInputFields: [],
      outputSchema: { teamAWinProbability: "number", teamBWinProbability: "number" },
    },
    "model-manifest.json": {
      modelVersion: "abc123",
      modelingRulesVersion: "vlr-modeling-rules@1.0.0",
      sourceFeatureDatasetVersion: "src1",
      featureSchemaVersion: "v1",
      featureRulesVersion: "v1",
      estimatorType: "constant-baseline",
      calibrationMethod: "none",
      randomSeed: 45045,
      trainRowCount: 0,
      validationRowCount: 0,
      testRowCount: 0,
      trainDateRangeStartIso: null,
      trainDateRangeEndIso: null,
      reportingThreshold: 0.5,
      probabilityClippingEpsilon: 1e-15,
      nodeRuntimeVersion: process.version,
      typescriptVersion: "5.0.0",
      generatedAt: "2026-01-01T00:00:00.000Z",
      selectionRationale: "test",
      contentHashes: {},
    },
    "model-card.json": { summary: "test", datasetSummary: {}, candidatesEvaluated: [], backtestSummary: {}, calibrationSummary: {}, selectionRationale: "test", finalTestSummary: {}, knownLimitations: [], nextStep: "test" },
    "evaluation.json": {
      baselineTestMetrics: {},
      validationMetrics: { logLoss: 0, brierScore: 0, rocAuc: null, accuracy: 0, balancedAccuracy: 0, precision: 0, recall: 0, f1: 0, expectedCalibrationError: 0, calibrationSlopeIntercept: null, averagePredictedProbability: 0, predictionSharpness: 0, positiveRate: 0, sampleCount: 0 },
      walkForward: { meanLogLoss: 0, medianLogLoss: 0, meanBrierScore: 0, pooledMetrics: { logLoss: 0, brierScore: 0, rocAuc: null, accuracy: 0, balancedAccuracy: 0, precision: 0, recall: 0, f1: 0, expectedCalibrationError: 0, calibrationSlopeIntercept: null, averagePredictedProbability: 0, predictionSharpness: 0, positiveRate: 0, sampleCount: 0 }, folds: [] },
      testMetricsUncalibrated: { logLoss: 0, brierScore: 0, rocAuc: null, accuracy: 0, balancedAccuracy: 0, precision: 0, recall: 0, f1: 0, expectedCalibrationError: 0, calibrationSlopeIntercept: null, averagePredictedProbability: 0, predictionSharpness: 0, positiveRate: 0, sampleCount: 0 },
      testMetricsCalibrated: { logLoss: 0, brierScore: 0, rocAuc: null, accuracy: 0, balancedAccuracy: 0, precision: 0, recall: 0, f1: 0, expectedCalibrationError: 0, calibrationSlopeIntercept: null, averagePredictedProbability: 0, predictionSharpness: 0, positiveRate: 0, sampleCount: 0 },
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
    "feature-importance.json": { method: "standardized-coefficient", topPositive: [], topNegative: [], unstableFeatures: [], zeroOrUnusedFeatures: [], caveat: "test" },
    ...overrides,
  };
}

describe("writeModelArtifact / loadModelArtifactForInference", () => {
  it("writes every artifact file and returns a content hash for each", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "vlr-model-artifact-test-"));
    const hashes = await writeModelArtifact(dataDir, baseFiles());
    expect(Object.keys(hashes)).toHaveLength(11);
    expect(hashes["model.json"]).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces byte-identical content and identical hashes across two writes of the same input (idempotency)", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "vlr-model-artifact-test-"));
    const files = baseFiles();
    const firstHashes = await writeModelArtifact(dataDir, files);
    const secondHashes = await writeModelArtifact(dataDir, files);
    expect(secondHashes).toEqual(firstHashes);
  });

  it("round-trips the inference-relevant files losslessly", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "vlr-model-artifact-test-"));
    await writeModelArtifact(dataDir, baseFiles({ "model.json": { estimatorType: "constant-baseline", value: 0.73 } }));
    const loaded = await loadModelArtifactForInference(dataDir);
    expect(loaded.model).toEqual({ estimatorType: "constant-baseline", value: 0.73 });
    expect(loaded.manifest.modelVersion).toBe("abc123");
  });

  it("throws ModelingError with an artifact_not_found code when no artifact exists yet", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "vlr-model-artifact-test-empty-"));
    await expect(loadModelArtifactForInference(dataDir)).rejects.toBeInstanceOf(ModelingError);
  });
});
