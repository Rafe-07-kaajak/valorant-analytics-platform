import { describe, expect, it } from "vitest";
import { assignSplits, computeSplitBoundaries, computeWalkForwardFolds, summarizeSplits } from "./splits";
import type { FeatureRow } from "./types";

function buildRows(count: number): FeatureRow[] {
  const rows: FeatureRow[] = [];
  for (let i = 0; i < count; i += 1) {
    rows.push({
      matchInternalId: `vlr:match:${i}`,
      scheduledAt: new Date(i * 86_400_000).toISOString(),
      seasonYear: 2025,
      eventFamily: i % 2 === 0 ? "vct-americas" : "masters",
      teamAIsColdStart: i < 3,
      teamBIsColdStart: false,
    } as unknown as FeatureRow);
  }
  return rows;
}

describe("computeSplitBoundaries / assignSplits", () => {
  it("splits chronologically using actual row counts, never a guessed date", () => {
    const rows = buildRows(100);
    const boundaries = computeSplitBoundaries(rows);
    expect(boundaries.trainRowCount).toBe(70);
    expect(boundaries.validationRowCount).toBe(15);
    expect(boundaries.testRowCount).toBe(15);
    expect(boundaries.trainEndIso).toBe(rows[69]!.scheduledAt);
  });

  it("assigns every row to exactly one split, in chronological order with no overlap", () => {
    const rows = buildRows(20);
    const boundaries = computeSplitBoundaries(rows);
    const assignments = assignSplits(rows, boundaries);
    expect(assignments).toHaveLength(20);
    const trainIds = new Set(assignments.filter((a) => a.split === "train").map((a) => a.matchInternalId));
    const validationIds = new Set(assignments.filter((a) => a.split === "validation").map((a) => a.matchInternalId));
    const testIds = new Set(assignments.filter((a) => a.split === "test").map((a) => a.matchInternalId));
    expect([...trainIds].every((id) => !validationIds.has(id) && !testIds.has(id))).toBe(true);
    // validation must be strictly after train chronologically.
    const lastTrainIndex = Math.max(...[...trainIds].map((id) => rows.findIndex((r) => r.matchInternalId === id)));
    const firstValidationIndex = Math.min(...[...validationIds].map((id) => rows.findIndex((r) => r.matchInternalId === id)));
    expect(firstValidationIndex).toBeGreaterThan(lastTrainIndex);
  });

  it("is deterministic across repeated calls", () => {
    const rows = buildRows(50);
    const boundaries = computeSplitBoundaries(rows);
    expect(assignSplits(rows, boundaries)).toEqual(assignSplits(rows, boundaries));
  });

  it("reports year/family distribution and cold-start rate per split", () => {
    const rows = buildRows(20);
    const boundaries = computeSplitBoundaries(rows);
    const summary = summarizeSplits(rows, boundaries);
    expect(summary.train.rowCount).toBe(boundaries.trainRowCount);
    expect(summary.train.byYear[2025]).toBe(boundaries.trainRowCount);
    expect(summary.train.coldStartRate).toBeGreaterThan(0); // first 3 rows are cold-start and land in train
  });
});

describe("computeWalkForwardFolds", () => {
  it("produces folds whose validation set is always strictly after its own train set", () => {
    const rows = buildRows(100);
    const folds = computeWalkForwardFolds(rows);
    expect(folds.length).toBeGreaterThan(0);
    for (const fold of folds) {
      expect(fold.trainEndIso).not.toBeNull();
      expect(fold.validationStartIso).not.toBeNull();
      expect(new Date(fold.validationStartIso!).getTime()).toBeGreaterThan(new Date(fold.trainEndIso!).getTime());
    }
  });

  it("expands the train window across folds (no fold's train shrinks)", () => {
    const rows = buildRows(100);
    const folds = computeWalkForwardFolds(rows);
    for (let i = 1; i < folds.length; i += 1) {
      expect(folds[i]!.trainRowCount).toBeGreaterThanOrEqual(folds[i - 1]!.trainRowCount);
    }
  });

  it("never lets a fold's validation rows overlap its own train rows", () => {
    const rows = buildRows(100);
    const folds = computeWalkForwardFolds(rows);
    for (const fold of folds) {
      const trainSet = new Set(fold.trainMatchInternalIds);
      expect(fold.validationMatchInternalIds.every((id) => !trainSet.has(id))).toBe(true);
    }
  });

  it("returns no folds for an empty dataset", () => {
    expect(computeWalkForwardFolds([])).toEqual([]);
  });

  it("is deterministic across repeated calls", () => {
    const rows = buildRows(60);
    expect(computeWalkForwardFolds(rows)).toEqual(computeWalkForwardFolds(rows));
  });
});
