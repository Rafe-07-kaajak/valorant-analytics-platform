import { describe, expect, it } from "vitest";
import { predict, type ModelInputRow } from "./inference";
import { ModelingError } from "./errors";
import type { LoadedModelArtifact } from "./artifact";

function loadedArtifact(overrides: Partial<LoadedModelArtifact> = {}): LoadedModelArtifact {
  return {
    model: { estimatorType: "logistic-regression", weights: [2], bias: 0, featureNames: ["teamAEloRating"], config: { l2Lambda: 0.01, iterations: 1, learningRate: 0.01 } },
    preprocessing: { numericFields: ["teamAEloRating"], nullableNumericFields: [], booleanFields: [], categoricalFields: [], medianByField: { teamAEloRating: 1500 }, meanByField: { teamAEloRating: 1500 }, stdByField: { teamAEloRating: 200 }, vocabularyByField: {}, featureNames: ["teamAEloRating"] },
    calibration: { method: "none" },
    featureContract: {
      featureSchemaVersion: "v1",
      featureRulesVersion: "v1",
      numericFields: ["teamAEloRating"],
      nullableNumericFields: [],
      booleanFields: [],
      categoricalFields: [],
      categoricalVocabulary: {},
      encodedFeatureNames: ["teamAEloRating"],
      excludedFields: [],
      requiredInputFields: ["teamAEloRating"],
      outputSchema: { teamAWinProbability: "number", teamBWinProbability: "number" },
    },
    manifest: {
      modelVersion: "v1",
      modelingRulesVersion: "vlr-modeling-rules@1.0.0",
      sourceFeatureDatasetVersion: "s1",
      featureSchemaVersion: "v1",
      featureRulesVersion: "v1",
      estimatorType: "logistic-regression",
      calibrationMethod: "none",
      randomSeed: 45045,
      trainRowCount: 1,
      validationRowCount: 1,
      testRowCount: 1,
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
    ...overrides,
  };
}

describe("predict", () => {
  it("returns probabilities that sum to exactly 1", () => {
    const result = predict(loadedArtifact(), { teamAEloRating: 1700 });
    expect(result.teamAWinProbability + result.teamBWinProbability).toBe(1);
  });

  it("rejects a row missing a required feature", () => {
    expect(() => predict(loadedArtifact(), {})).toThrow(ModelingError);
  });

  it("rejects a NaN/Infinite required feature value", () => {
    expect(() => predict(loadedArtifact(), { teamAEloRating: Number.NaN })).toThrow(ModelingError);
    expect(() => predict(loadedArtifact(), { teamAEloRating: Number.POSITIVE_INFINITY })).toThrow(ModelingError);
  });

  it("is deterministic — an identical row always produces an identical prediction", () => {
    const row: ModelInputRow = { teamAEloRating: 1650 };
    const first = predict(loadedArtifact(), row);
    const second = predict(loadedArtifact(), row);
    expect(first).toEqual(second);
  });

  it("a higher Elo-like input increases the predicted win probability for a positive-weight model", () => {
    const low = predict(loadedArtifact(), { teamAEloRating: 1300 });
    const high = predict(loadedArtifact(), { teamAEloRating: 1700 });
    expect(high.teamAWinProbability).toBeGreaterThan(low.teamAWinProbability);
  });

  it("elo-baseline reads teamAEloWinProbability directly and rejects it when missing", () => {
    const eloArtifact = loadedArtifact({ model: { estimatorType: "elo-baseline" } });
    expect(predict(eloArtifact, { teamAEloWinProbability: 0.63 }).teamAWinProbability).toBe(0.63);
    expect(() => predict(eloArtifact, {})).toThrow(ModelingError);
  });

  it("class-prior-baseline and constant-baseline ignore the input row entirely", () => {
    const priorArtifact = loadedArtifact({ model: { estimatorType: "class-prior-baseline", prior: 0.47 } });
    expect(predict(priorArtifact, {}).teamAWinProbability).toBe(0.47);
    const constantArtifact = loadedArtifact({ model: { estimatorType: "constant-baseline", value: 0.5 } });
    expect(predict(constantArtifact, {}).teamAWinProbability).toBe(0.5);
  });

  it("never accesses the network (no fetch/XHR reference anywhere in the module)", async () => {
    const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("./inference.ts", import.meta.url), "utf-8"));
    expect(source).not.toMatch(/fetch\(|XMLHttpRequest/);
  });
});
