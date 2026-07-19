import { describe, expect, it } from "vitest";
import { buildMockFeatureRow } from "./testUtils/mockFeatureRow";
import { fitPreprocessor, transformRows, transformSingleRow } from "./preprocessing";
import type { FeaturePolicy } from "./featurePolicy";

const POLICY: FeaturePolicy = {
  numericFields: ["teamAEloRating"],
  booleanFields: ["teamAIsColdStart"],
  categoricalFields: ["eventFamily"],
  excludedFields: [],
  allInputFields: ["teamAEloRating", "teamAIsColdStart", "eventFamily"],
};

describe("fitPreprocessor / transformRows", () => {
  it("fits medians/means/std strictly from the rows it is given (train only)", () => {
    const trainRows = [buildMockFeatureRow({ teamAEloRating: 1000 }), buildMockFeatureRow({ teamAEloRating: 2000 })];
    const state = fitPreprocessor(trainRows, POLICY);
    expect(state.meanByField.teamAEloRating).toBe(1500);

    // A later change to what would be "validation" data must never affect the already-fit statistics.
    const validationRows = [buildMockFeatureRow({ teamAEloRating: 9_000_000 })];
    const { matrix } = transformRows(validationRows, state);
    expect(state.meanByField.teamAEloRating).toBe(1500);
    expect(Number.isFinite(matrix[0]![0]!)).toBe(true);
  });

  it("produces a deterministic feature-name order across repeated fits on identical input", () => {
    const rows = [buildMockFeatureRow({ eventFamily: "masters" }), buildMockFeatureRow({ eventFamily: "vct-americas" })];
    const stateA = fitPreprocessor(rows, POLICY);
    const stateB = fitPreprocessor(rows, POLICY);
    expect(stateA.featureNames).toEqual(stateB.featureNames);
  });

  it("one-hot encodes categorical values using only the training vocabulary, plus an explicit unknown bucket", () => {
    const trainRows = [buildMockFeatureRow({ eventFamily: "masters" }), buildMockFeatureRow({ eventFamily: "champions" })];
    const state = fitPreprocessor(trainRows, POLICY);
    expect(state.vocabularyByField.eventFamily).toEqual(["champions", "masters"]);

    const unseenRow = buildMockFeatureRow({ eventFamily: "vct-pacific" });
    const encoded = transformSingleRow(unseenRow, state);
    const unknownIndex = state.featureNames.indexOf("eventFamily=__unknown__");
    const championsIndex = state.featureNames.indexOf("eventFamily=champions");
    const mastersIndex = state.featureNames.indexOf("eventFamily=masters");
    expect(encoded[unknownIndex]).toBe(1);
    expect(encoded[championsIndex]).toBe(0);
    expect(encoded[mastersIndex]).toBe(0);
  });

  it("adds a missing-indicator column only for numeric fields that were actually null in training", () => {
    const policyWithNullable: FeaturePolicy = { ...POLICY, numericFields: ["teamADaysSinceLastMatch"], allInputFields: ["teamADaysSinceLastMatch", "teamAIsColdStart", "eventFamily"] };
    const trainRows = [buildMockFeatureRow({ teamADaysSinceLastMatch: null }), buildMockFeatureRow({ teamADaysSinceLastMatch: 5 })];
    const state = fitPreprocessor(trainRows, policyWithNullable);
    expect(state.nullableNumericFields).toContain("teamADaysSinceLastMatch");
    expect(state.featureNames).toContain("teamADaysSinceLastMatch__isMissing");
  });

  it("never adds a missing-indicator column for a field with no nulls in training", () => {
    const trainRows = [buildMockFeatureRow({ teamAEloRating: 1500 }), buildMockFeatureRow({ teamAEloRating: 1600 })];
    const state = fitPreprocessor(trainRows, POLICY);
    expect(state.nullableNumericFields).toEqual([]);
    expect(state.featureNames.some((n) => n.endsWith("__isMissing"))).toBe(false);
  });

  it("guards against zero variance (constant feature) without producing NaN/Infinity", () => {
    const trainRows = [buildMockFeatureRow({ teamAEloRating: 1500 }), buildMockFeatureRow({ teamAEloRating: 1500 })];
    const state = fitPreprocessor(trainRows, POLICY);
    expect(state.stdByField.teamAEloRating).toBe(1);
    const { matrix } = transformRows(trainRows, state);
    for (const row of matrix) for (const value of row) expect(Number.isFinite(value)).toBe(true);
  });

  it("imputes a null encountered only at transform time using the training median, without crashing", () => {
    const trainRows = [buildMockFeatureRow({ teamAEloRating: 1400 }), buildMockFeatureRow({ teamAEloRating: 1600 })];
    const state = fitPreprocessor(trainRows, POLICY);
    const rowWithSurpriseNull = buildMockFeatureRow({ teamAEloRating: null as unknown as number });
    const encoded = transformSingleRow(rowWithSurpriseNull, state);
    expect(Number.isFinite(encoded[0]!)).toBe(true);
  });
});
