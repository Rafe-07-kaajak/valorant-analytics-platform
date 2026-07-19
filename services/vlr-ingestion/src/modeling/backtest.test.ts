import { describe, expect, it } from "vitest";
import type { WalkForwardFold } from "../feature/splits";
import { buildMockFeatureRow } from "./testUtils/mockFeatureRow";
import { runWalkForwardBacktest } from "./backtest";
import { constantFoldFn } from "./candidates";
import { ModelingError } from "./errors";

function makeRows() {
  return [
    buildMockFeatureRow({ matchInternalId: "m1", labelTeamAWin: 1 }),
    buildMockFeatureRow({ matchInternalId: "m2", labelTeamAWin: 0 }),
    buildMockFeatureRow({ matchInternalId: "m3", labelTeamAWin: 1 }),
    buildMockFeatureRow({ matchInternalId: "m4", labelTeamAWin: 0 }),
  ];
}

function makeFolds(): readonly WalkForwardFold[] {
  return [
    { foldId: 0, trainRowCount: 2, validationRowCount: 2, trainStartIso: null, trainEndIso: null, validationStartIso: null, validationEndIso: null, trainMatchInternalIds: ["m1", "m2"], validationMatchInternalIds: ["m3", "m4"] },
  ];
}

describe("runWalkForwardBacktest", () => {
  it("computes per-fold metrics from the fold's own validation rows only", () => {
    const result = runWalkForwardBacktest(makeFolds(), makeRows(), constantFoldFn);
    expect(result.folds).toHaveLength(1);
    expect(result.folds[0]!.predictions.map((p) => p.matchInternalId)).toEqual(["m3", "m4"]);
    expect(result.folds[0]!.metrics.sampleCount).toBe(2);
  });

  it("passes each fold only its own precomputed train rows, never validation rows", () => {
    let observedTrainIds: readonly string[] = [];
    runWalkForwardBacktest(makeFolds(), makeRows(), (trainRows, evalRows) => {
      observedTrainIds = trainRows.map((r) => r.matchInternalId);
      return evalRows.map(() => 0.5);
    });
    expect(observedTrainIds).toEqual(["m1", "m2"]);
  });

  it("throws when a fold's prediction count does not match its validation row count", () => {
    expect(() => runWalkForwardBacktest(makeFolds(), makeRows(), () => [0.5])).toThrow(ModelingError);
  });

  it("throws when a fold references a match ID absent from the row set", () => {
    const badFolds: readonly WalkForwardFold[] = [{ ...makeFolds()[0]!, validationMatchInternalIds: ["does-not-exist"] }];
    expect(() => runWalkForwardBacktest(badFolds, makeRows(), constantFoldFn)).toThrow(ModelingError);
  });

  it("throws on an empty fold list rather than silently reporting empty aggregates", () => {
    expect(() => runWalkForwardBacktest([], makeRows(), constantFoldFn)).toThrow(ModelingError);
  });

  it("pools every fold's predictions for the weighted/pooled metric view", () => {
    const result = runWalkForwardBacktest(makeFolds(), makeRows(), constantFoldFn);
    expect(result.pooledMetrics.sampleCount).toBe(2);
  });
});
