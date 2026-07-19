import { describe, expect, it } from "vitest";
import { buildMockFeatureRow } from "./testUtils/mockFeatureRow";
import { classPriorPredict, constantBaselinePredict, eloBaselinePredict, fitClassPrior } from "./baselines";

describe("constantBaselinePredict", () => {
  it("always predicts 0.5", () => {
    const rows = [buildMockFeatureRow(), buildMockFeatureRow()];
    expect(constantBaselinePredict(rows)).toEqual([0.5, 0.5]);
  });
});

describe("fitClassPrior / classPriorPredict", () => {
  it("computes the training-set Team A win rate", () => {
    const trainRows = [buildMockFeatureRow({ labelTeamAWin: 1 }), buildMockFeatureRow({ labelTeamAWin: 1 }), buildMockFeatureRow({ labelTeamAWin: 0 }), buildMockFeatureRow({ labelTeamAWin: 0 })];
    expect(fitClassPrior(trainRows)).toBe(0.5);
  });

  it("falls back to 0.5 for an empty training set", () => {
    expect(fitClassPrior([])).toBe(0.5);
  });

  it("applies a fixed prior to every row, never refitting on the evaluation rows", () => {
    const evalRows = [buildMockFeatureRow(), buildMockFeatureRow(), buildMockFeatureRow()];
    expect(classPriorPredict(evalRows, 0.7)).toEqual([0.7, 0.7, 0.7]);
  });
});

describe("eloBaselinePredict", () => {
  it("reads TASK-044's own pre-match Elo win probability directly, unmodified", () => {
    const rows = [buildMockFeatureRow({ teamAEloWinProbability: 0.63 }), buildMockFeatureRow({ teamAEloWinProbability: 0.2 })];
    expect(eloBaselinePredict(rows)).toEqual([0.63, 0.2]);
  });
});
