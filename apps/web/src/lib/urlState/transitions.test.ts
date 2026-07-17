import { describe, expect, it } from "vitest";
import { EMPTY_CANONICAL_URL_STATE } from "./types";
import { withFormat, withMaps, withRegionA, withRegionB, withTeamA, withTeamB } from "./transitions";

const VALID_MAP_IDS = new Set(["ascent", "haven", "bind", "lotus", "pearl", "split", "sunset", "icebox"]);

describe("withRegionA / withRegionB", () => {
  it("sets the region and clears that side's team", () => {
    const state = { ...EMPTY_CANONICAL_URL_STATE, teamA: "paper-rex" as const, regionA: "pacific" as const };
    expect(withRegionA(state, "emea")).toEqual({ ...state, regionA: "emea", teamA: null });
  });

  it("does not affect the other side", () => {
    const state = { ...EMPTY_CANONICAL_URL_STATE, teamB: "g2-esports" as const, regionB: "americas" as const };
    expect(withRegionA(state, "emea").teamB).toBe("g2-esports");
    expect(withRegionB(state, "pacific").teamA).toBeNull();
  });
});

describe("withTeamA / withTeamB", () => {
  it("sets the team and derives its real region, regardless of prior region", () => {
    const state = { ...EMPTY_CANONICAL_URL_STATE, regionA: "emea" as const };
    expect(withTeamA(state, "paper-rex")).toEqual({ ...state, teamA: "paper-rex", regionA: "pacific" });
  });

  it("withTeamB mirrors withTeamA for side B", () => {
    const state = { ...EMPTY_CANONICAL_URL_STATE };
    expect(withTeamB(state, "g2-esports")).toEqual({ ...state, teamB: "g2-esports", regionB: "americas" });
  });
});

describe("withMaps", () => {
  it("dedupes and canonically orders", () => {
    const state = { ...EMPTY_CANONICAL_URL_STATE };
    expect(withMaps(state, ["haven", "ascent", "haven"], VALID_MAP_IDS).maps).toEqual(["ascent", "haven"]);
  });

  it("caps to the current format's series limit", () => {
    const state = { ...EMPTY_CANONICAL_URL_STATE, format: "BO3" as const };
    expect(withMaps(state, ["ascent", "haven", "bind", "lotus"], VALID_MAP_IDS).maps).toEqual(["ascent", "haven", "bind"]);
  });

  it("does not cap when no format is set", () => {
    const state = { ...EMPTY_CANONICAL_URL_STATE };
    expect(withMaps(state, ["ascent", "haven", "bind", "lotus"], VALID_MAP_IDS).maps).toHaveLength(4);
  });

  it("supports an empty pool", () => {
    const state = { ...EMPTY_CANONICAL_URL_STATE, maps: ["ascent"] };
    expect(withMaps(state, [], VALID_MAP_IDS).maps).toEqual([]);
  });
});

describe("withFormat", () => {
  it("sets the format and caps existing maps to the new limit", () => {
    const state = { ...EMPTY_CANONICAL_URL_STATE, maps: ["ascent", "haven", "bind", "lotus", "pearl"] };
    expect(withFormat(state, "BO3").maps).toEqual(["ascent", "haven", "bind"]);
  });

  it("does not truncate when the new format's limit is not exceeded", () => {
    const state = { ...EMPTY_CANONICAL_URL_STATE, maps: ["ascent"] };
    expect(withFormat(state, "BO5").maps).toEqual(["ascent"]);
  });
});
