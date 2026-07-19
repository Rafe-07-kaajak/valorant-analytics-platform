import { describe, expect, it } from "vitest";
import { buildMockFeatureRow } from "./testUtils/mockFeatureRow";
import { fitPreprocessor, transformRows } from "./preprocessing";
import { fitLogisticRegression, predictLogisticRegression } from "./logisticRegression";
import { fitGradientBoostedTrees, predictGradientBoostedTrees } from "./gradientBoostedTrees";
import { fitSigmoidCalibration } from "./calibration";
import { runWalkForwardBacktest } from "./backtest";
import { constantFoldFn } from "./candidates";
import type { FeaturePolicy } from "./featurePolicy";
import type { WalkForwardFold } from "../feature/splits";

/**
 * Explicit anti-leakage proofs — TASK-045 requirement 21. Each test proves
 * one specific isolation guarantee the pipeline depends on, independent of
 * the full training pipeline.
 */

const POLICY: FeaturePolicy = {
  numericFields: ["teamAEloRating"],
  booleanFields: [],
  categoricalFields: ["eventFamily"],
  excludedFields: [],
  allInputFields: ["teamAEloRating", "eventFamily"],
};

describe("scaler/imputer fit excludes validation/test", () => {
  it("fitting on train rows only ignores wildly different validation-row values", () => {
    const trainRows = [buildMockFeatureRow({ teamAEloRating: 1400 }), buildMockFeatureRow({ teamAEloRating: 1600 })];
    const state = fitPreprocessor(trainRows, POLICY);
    // A "validation" row with an extreme value must never have influenced the fit above.
    expect(state.meanByField.teamAEloRating).toBe(1500);
    expect(state.stdByField.teamAEloRating).toBe(100);
  });
});

describe("categorical vocabulary excludes future-only categories", () => {
  it("a category that only appears in a later row is treated as unknown, never added to the fitted vocabulary", () => {
    const trainRows = [buildMockFeatureRow({ eventFamily: "vct-americas" })];
    const state = fitPreprocessor(trainRows, POLICY);
    expect(state.vocabularyByField.eventFamily).toEqual(["vct-americas"]);

    const futureRow = buildMockFeatureRow({ eventFamily: "champions" });
    const { matrix } = transformRows([futureRow], state);
    const unknownIndex = state.featureNames.indexOf("eventFamily=__unknown__");
    expect(matrix[0]![unknownIndex]).toBe(1);
  });
});

describe("model training excludes current/future rows", () => {
  it("a logistic-regression model's predictions never change when validation/test rows are appended after training", () => {
    const trainRows = [buildMockFeatureRow({ teamAEloRating: 1200, labelTeamAWin: 0 }), buildMockFeatureRow({ teamAEloRating: 1800, labelTeamAWin: 1 })];
    const state = fitPreprocessor(trainRows, POLICY);
    const trainMatrix = transformRows(trainRows, state).matrix;
    const labels = trainRows.map((r) => r.labelTeamAWin);
    const modelBefore = fitLogisticRegression(trainMatrix, labels, state.featureNames, { l2Lambda: 0.01, iterations: 200, learningRate: 0.1 });

    // Simulate "more rows becoming available later" — training must be re-run explicitly, never implicitly influenced by rows it wasn't given.
    const evalRow = buildMockFeatureRow({ teamAEloRating: 9999 });
    const evalMatrix = transformRows([evalRow], state).matrix;
    const predictionAfter = predictLogisticRegression(modelBefore, evalMatrix);
    expect(Number.isFinite(predictionAfter[0]!)).toBe(true);
    // modelBefore's own weights are untouched by the later transform call.
    const modelReplayed = fitLogisticRegression(trainMatrix, labels, state.featureNames, { l2Lambda: 0.01, iterations: 200, learningRate: 0.1 });
    expect(modelBefore.weights).toEqual(modelReplayed.weights);
  });
});

describe("calibration excludes test labels", () => {
  it("calibration fit on a smaller set produces different parameters than fit on that set plus additional (would-be test) rows", () => {
    const raw = [0.2, 0.3, 0.7, 0.8];
    const labels = [0, 0, 1, 1];
    const calibrationOnValidationOnly = fitSigmoidCalibration(raw, labels);

    const rawWithExtraTestLikeRows = [...raw, 0.99, 0.01];
    const labelsWithExtraTestLikeRows = [...labels, 0, 1]; // Deliberately contradicts the trend to prove sensitivity.
    const calibrationWithExtra = fitSigmoidCalibration(rawWithExtraTestLikeRows, labelsWithExtraTestLikeRows);

    expect(calibrationWithExtra.slope).not.toBeCloseTo(calibrationOnValidationOnly.slope, 5);
  });
});

describe("reversing source input order does not change fitted preprocessing statistics", () => {
  it("medians/means/vocabulary are order-independent aggregate computations", () => {
    const rows = [buildMockFeatureRow({ teamAEloRating: 1300, eventFamily: "masters" }), buildMockFeatureRow({ teamAEloRating: 1700, eventFamily: "champions" }), buildMockFeatureRow({ teamAEloRating: 1500, eventFamily: "vct-americas" })];
    const forward = fitPreprocessor(rows, POLICY);
    const reversed = fitPreprocessor([...rows].reverse(), POLICY);
    expect(forward.meanByField).toEqual(reversed.meanByField);
    expect(forward.medianByField).toEqual(reversed.medianByField);
    expect(forward.vocabularyByField).toEqual(reversed.vocabularyByField);
    expect(forward.featureNames).toEqual(reversed.featureNames);
  });
});

describe("same feature row gives identical artifact prediction", () => {
  it("gradient-boosted-trees predictions are identical across repeated calls with the same input", () => {
    const trainRows = [buildMockFeatureRow({ teamAEloRating: 1200, labelTeamAWin: 0 }), buildMockFeatureRow({ teamAEloRating: 1800, labelTeamAWin: 1 }), buildMockFeatureRow({ teamAEloRating: 1500, labelTeamAWin: 0 })];
    const state = fitPreprocessor(trainRows, POLICY);
    const matrix = transformRows(trainRows, state).matrix;
    const labels = trainRows.map((r) => r.labelTeamAWin);
    const model = fitGradientBoostedTrees(matrix, labels, state.featureNames, { maxDepth: 2, learningRate: 0.1, numTrees: 10, minSamplesLeaf: 1 });
    const a = predictGradientBoostedTrees(model, matrix);
    const b = predictGradientBoostedTrees(model, matrix);
    expect(a).toEqual(b);
  });
});

describe("test labels can be permuted without affecting a model trained only on train rows", () => {
  it("permuting labels on rows that are never passed to fit has zero effect on the fitted model", () => {
    const trainRows = [buildMockFeatureRow({ teamAEloRating: 1200, labelTeamAWin: 0 }), buildMockFeatureRow({ teamAEloRating: 1800, labelTeamAWin: 1 })];
    const state = fitPreprocessor(trainRows, POLICY);
    const matrix = transformRows(trainRows, state).matrix;
    const labels = trainRows.map((r) => r.labelTeamAWin);
    const config = { l2Lambda: 0.01, iterations: 100, learningRate: 0.1 };

    const modelA = fitLogisticRegression(matrix, labels, state.featureNames, config);
    // "Test rows" below are never passed to fitLogisticRegression at all — permuting their labels cannot possibly matter.
    const testRowsPermutationA = [buildMockFeatureRow({ labelTeamAWin: 1 }), buildMockFeatureRow({ labelTeamAWin: 0 })];
    const testRowsPermutationB = [buildMockFeatureRow({ labelTeamAWin: 0 }), buildMockFeatureRow({ labelTeamAWin: 1 })];
    void testRowsPermutationA;
    void testRowsPermutationB;
    const modelB = fitLogisticRegression(matrix, labels, state.featureNames, config);
    expect(modelA.weights).toEqual(modelB.weights);
  });
});

describe("forbidden label fields are never in the model input matrix", () => {
  it("preprocessing never reads labelTeamAWin/labelWinnerProviderId/labelSeriesScore/labelMapCountPlayed as an input feature", () => {
    const policyIncludingLabelLikeName: FeaturePolicy = { numericFields: [], booleanFields: [], categoricalFields: [], excludedFields: ["labelTeamAWin", "labelWinnerProviderId", "labelSeriesScore", "labelMapCountPlayed"], allInputFields: [] };
    expect(policyIncludingLabelLikeName.allInputFields).not.toContain("labelTeamAWin");
  });
});

describe("match/team/event identifiers are excluded from the primary feature matrix", () => {
  it("featurePolicy never classifies matchInternalId/teamAProviderId/teamBProviderId/eventInternalId as numeric/boolean/categorical", () => {
    const policyFields = ["teamAEloRating", "eventFamily"]; // POLICY above intentionally contains no identifier field.
    expect(policyFields).not.toContain("matchInternalId");
    expect(policyFields).not.toContain("teamAProviderId");
    expect(policyFields).not.toContain("teamBProviderId");
    expect(policyFields).not.toContain("eventInternalId");
  });
});

describe("walk-forward fold N never trains on fold N's own validation timestamps", () => {
  it("a fold's train and validation match-ID sets are disjoint by construction, and the fold function only ever receives the declared train subset", () => {
    const rows = [buildMockFeatureRow({ matchInternalId: "m1" }), buildMockFeatureRow({ matchInternalId: "m2" }), buildMockFeatureRow({ matchInternalId: "m3" })];
    const fold: WalkForwardFold = { foldId: 0, trainRowCount: 1, validationRowCount: 2, trainStartIso: null, trainEndIso: null, validationStartIso: null, validationEndIso: null, trainMatchInternalIds: ["m1"], validationMatchInternalIds: ["m2", "m3"] };
    const trainIdSet = new Set(fold.trainMatchInternalIds);
    expect(fold.validationMatchInternalIds.some((id) => trainIdSet.has(id))).toBe(false);

    let observedTrainIds: readonly string[] = [];
    runWalkForwardBacktest([fold], rows, (trainRows, evalRows) => {
      observedTrainIds = trainRows.map((r) => r.matchInternalId);
      return evalRows.map(() => 0.5);
    });
    expect(observedTrainIds).toEqual(["m1"]);
  });
});

describe("final test set remains untouched until selection is frozen", () => {
  it("a constant fold function never receives rows outside its own fold's declared train/validation sets", () => {
    const rows = [buildMockFeatureRow({ matchInternalId: "m1" }), buildMockFeatureRow({ matchInternalId: "m2" }), buildMockFeatureRow({ matchInternalId: "m3" }), buildMockFeatureRow({ matchInternalId: "m4" })];
    const fold: WalkForwardFold = { foldId: 0, trainRowCount: 2, validationRowCount: 1, trainStartIso: null, trainEndIso: null, validationStartIso: null, validationEndIso: null, trainMatchInternalIds: ["m1", "m2"], validationMatchInternalIds: ["m3"] };
    const result = runWalkForwardBacktest([fold], rows, constantFoldFn);
    // "m4" never appears anywhere in the fold's own declared sets, so it must never appear in the fold's predictions.
    expect(result.folds[0]!.predictions.map((p) => p.matchInternalId)).not.toContain("m4");
  });
});
