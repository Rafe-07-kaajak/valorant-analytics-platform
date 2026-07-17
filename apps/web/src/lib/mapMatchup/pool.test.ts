import { describe, expect, it } from "vitest";
import { computePoolAggregate } from "./pool";
import type { MapComparisonRow } from "../teamComparison";

function row(mapId: string, scoreA: number, scoreB: number): MapComparisonRow {
  const magnitude = Math.round(Math.abs(scoreA - scoreB) * 10) / 10;
  const advantage = magnitude < 3 ? "even" : scoreA > scoreB ? "A" : "B";
  const tier = magnitude < 3 ? "none" : magnitude < 8 ? "slight" : magnitude < 16 ? "moderate" : "strong";
  return { mapId, mapName: mapId, scoreA, scoreB, advantage, tier, magnitude };
}

describe("computePoolAggregate", () => {
  it("returns null for an empty pool", () => {
    expect(computePoolAggregate([row("ascent", 70, 60)], [])).toBeNull();
  });

  it("handles a single-map pool correctly", () => {
    const rows = [row("ascent", 70, 60), row("bind", 50, 55)];
    const aggregate = computePoolAggregate(rows, ["ascent"]);
    expect(aggregate?.mapCount).toBe(1);
    expect(aggregate?.averageA).toBe(70);
    expect(aggregate?.averageB).toBe(60);
    expect(aggregate?.advantage).toBe("A");
  });

  it("handles the full map pool correctly", () => {
    const rows = [row("ascent", 70, 60), row("bind", 50, 80), row("haven", 61, 60)];
    const aggregate = computePoolAggregate(rows, ["ascent", "bind", "haven"]);
    expect(aggregate?.mapCount).toBe(3);
    expect(aggregate?.favoringA).toBe(1);
    expect(aggregate?.favoringB).toBe(1);
    expect(aggregate?.close).toBe(1);
  });

  it("computes averages with no NaN across a mixed pool", () => {
    const rows = [row("ascent", 70, 60), row("bind", 50, 80)];
    const aggregate = computePoolAggregate(rows, ["ascent", "bind"]);
    expect(Number.isNaN(aggregate?.averageA)).toBe(false);
    expect(Number.isNaN(aggregate?.averageB)).toBe(false);
    expect(Number.isNaN(aggregate?.magnitude)).toBe(false);
  });

  it("classifies a balanced pool as even, not falsely favoring a side", () => {
    const rows = [row("ascent", 61, 60), row("bind", 59, 60)];
    const aggregate = computePoolAggregate(rows, ["ascent", "bind"]);
    expect(aggregate?.advantage).toBe("even");
  });

  it("finds the pool-scoped strongest/closest/largest-gap maps, not roster-wide ones", () => {
    const rows = [row("ascent", 90, 40), row("bind", 60, 61), row("haven", 55, 95)];
    // Exclude "haven" (the roster-wide largest gap) from the pool.
    const aggregate = computePoolAggregate(rows, ["ascent", "bind"]);
    expect(aggregate?.largestGap?.mapId).toBe("ascent");
    expect(aggregate?.closest?.mapId).toBe("bind");
    expect(aggregate?.strongestA?.mapId).toBe("ascent");
    expect(aggregate?.strongestB?.mapId).toBe("bind");
  });

  it("is deterministic for the same input", () => {
    const rows = [row("ascent", 70, 60), row("bind", 50, 80)];
    expect(computePoolAggregate(rows, ["ascent", "bind"])).toEqual(computePoolAggregate(rows, ["ascent", "bind"]));
  });
});
