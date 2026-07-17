import { describe, expect, it } from "vitest";
import { rankMaps, resolveActiveMap } from "./ranking";
import type { MapComparisonRow } from "../teamComparison";

function row(overrides: Partial<MapComparisonRow>): MapComparisonRow {
  return {
    mapId: "ascent",
    mapName: "Ascent",
    scoreA: 60,
    scoreB: 60,
    advantage: "even",
    tier: "none",
    magnitude: 0,
    ...overrides,
  };
}

const ROWS: MapComparisonRow[] = [
  row({ mapId: "ascent", mapName: "Ascent", scoreA: 70, scoreB: 60, advantage: "A", tier: "slight", magnitude: 10 }),
  row({ mapId: "bind", mapName: "Bind", scoreA: 50, scoreB: 80, advantage: "B", tier: "strong", magnitude: 30 }),
  row({ mapId: "haven", mapName: "Haven", scoreA: 61, scoreB: 60, advantage: "even", tier: "none", magnitude: 1 }),
];

describe("rankMaps", () => {
  it("sorts by largest gap descending, with a map-name tie-breaker", () => {
    const ranked = rankMaps(ROWS, [], "largest-gap");
    expect(ranked.map((r) => r.mapId)).toEqual(["bind", "ascent", "haven"]);
  });

  it("sorts by closest matchup ascending", () => {
    const ranked = rankMaps(ROWS, [], "closest");
    expect(ranked.map((r) => r.mapId)).toEqual(["haven", "ascent", "bind"]);
  });

  it("sorts by map name alphabetically", () => {
    const ranked = rankMaps(ROWS, [], "map-name");
    expect(ranked.map((r) => r.mapId)).toEqual(["ascent", "bind", "haven"]);
  });

  it("sorts by Team A strength descending", () => {
    const ranked = rankMaps(ROWS, [], "team-a-strength");
    expect(ranked.map((r) => r.mapId)).toEqual(["ascent", "haven", "bind"]);
  });

  it("sorts by Team B strength descending", () => {
    const ranked = rankMaps(ROWS, [], "team-b-strength");
    expect(ranked.map((r) => r.mapId)).toEqual(["bind", "ascent", "haven"]);
  });

  it("breaks ties alphabetically when magnitudes are equal", () => {
    const tied: MapComparisonRow[] = [
      row({ mapId: "zzz-map", mapName: "Zzz Map", magnitude: 5, advantage: "A", tier: "slight" }),
      row({ mapId: "aaa-map", mapName: "Aaa Map", magnitude: 5, advantage: "A", tier: "slight" }),
    ];
    const ranked = rankMaps(tied, [], "largest-gap");
    expect(ranked.map((r) => r.mapId)).toEqual(["aaa-map", "zzz-map"]);
  });

  it("attaches pool-selection state without affecting sort order", () => {
    const rankedUnselected = rankMaps(ROWS, [], "largest-gap");
    const rankedSelected = rankMaps(ROWS, ["haven"], "largest-gap");
    expect(rankedUnselected.map((r) => r.mapId)).toEqual(rankedSelected.map((r) => r.mapId));
    expect(rankedSelected.find((r) => r.mapId === "haven")?.selected).toBe(true);
    expect(rankedSelected.find((r) => r.mapId === "ascent")?.selected).toBe(false);
  });

  it("is deterministic across repeated calls", () => {
    expect(rankMaps(ROWS, [], "largest-gap")).toEqual(rankMaps(ROWS, [], "largest-gap"));
  });

  it("does not mutate the input array", () => {
    const copy = [...ROWS];
    rankMaps(ROWS, [], "largest-gap");
    expect(ROWS).toEqual(copy);
  });
});

describe("resolveActiveMap", () => {
  const ranked = rankMaps(ROWS, [], "largest-gap");

  it("returns the requested map when it exists in the ranking", () => {
    expect(resolveActiveMap(ranked, "haven")?.mapId).toBe("haven");
  });

  it("falls back to the first ranked row when no id is given", () => {
    expect(resolveActiveMap(ranked, null)?.mapId).toBe(ranked[0]!.mapId);
  });

  it("falls back to the first ranked row when the requested id no longer exists", () => {
    expect(resolveActiveMap(ranked, "does-not-exist")?.mapId).toBe(ranked[0]!.mapId);
  });

  it("returns null when there are no ranked rows at all", () => {
    expect(resolveActiveMap([], "anything")).toBeNull();
    expect(resolveActiveMap([], null)).toBeNull();
  });
});
