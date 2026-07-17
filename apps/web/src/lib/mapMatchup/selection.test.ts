import { describe, expect, it } from "vitest";
import { clearMapSelection, selectAllMaps, selectCloseMaps, toggleMapSelection } from "./selection";
import type { MapComparisonRow } from "../teamComparison";

const MAPS = [
  { id: "ascent", name: "Ascent" },
  { id: "bind", name: "Bind" },
  { id: "haven", name: "Haven" },
];

describe("toggleMapSelection", () => {
  it("adds a map that isn't selected", () => {
    expect(toggleMapSelection([], "ascent")).toEqual(["ascent"]);
  });

  it("removes a map that is already selected", () => {
    expect(toggleMapSelection(["ascent", "bind"], "ascent")).toEqual(["bind"]);
  });

  it("does not mutate the input array", () => {
    const input = ["ascent"];
    toggleMapSelection(input, "bind");
    expect(input).toEqual(["ascent"]);
  });
});

describe("selectAllMaps / clearMapSelection", () => {
  it("selects every supported map id in order", () => {
    expect(selectAllMaps(MAPS)).toEqual(["ascent", "bind", "haven"]);
  });

  it("clears to an empty array", () => {
    expect(clearMapSelection()).toEqual([]);
  });
});

describe("selectCloseMaps", () => {
  function row(mapId: string, tier: MapComparisonRow["tier"]): MapComparisonRow {
    return { mapId, mapName: mapId, scoreA: 60, scoreB: 60, advantage: "even", tier, magnitude: 0 };
  }

  it("selects only maps classified as close/even (tier none)", () => {
    const rows = [row("ascent", "none"), row("bind", "slight"), row("haven", "none")];
    expect(selectCloseMaps(rows)).toEqual(["ascent", "haven"]);
  });

  it("returns an empty array when no maps are close", () => {
    const rows = [row("ascent", "slight"), row("bind", "strong")];
    expect(selectCloseMaps(rows)).toEqual([]);
  });

  it("is deterministic", () => {
    const rows = [row("ascent", "none"), row("bind", "moderate")];
    expect(selectCloseMaps(rows)).toEqual(selectCloseMaps(rows));
  });
});
