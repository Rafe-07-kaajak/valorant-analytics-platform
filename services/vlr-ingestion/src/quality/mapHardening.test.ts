import { describe, expect, it } from "vitest";
import { auditMatchMaps, isUnplayedMapPlaceholder } from "./mapHardening";
import { buildNormalizedMatch } from "../testUtils/normalizedMatchFixture";

describe("isUnplayedMapPlaceholder", () => {
  it.each(["N/A", "n/a", "TBD", "", "  ", "Unplayed"])("recognizes %s as a placeholder, never a real map", (raw) => {
    expect(isUnplayedMapPlaceholder(raw)).toBe(true);
  });

  it("does not treat a real map name as a placeholder", () => {
    expect(isUnplayedMapPlaceholder("Ascent")).toBe(false);
  });
});

describe("auditMatchMaps", () => {
  it("raises no issues for an all-recognized map sequence", () => {
    expect(auditMatchMaps(buildNormalizedMatch(), "t")).toHaveLength(0);
  });

  it("flags an unrecognized map name as unknown_map, never remapping it", () => {
    const match = buildNormalizedMatch({ maps: [{ map: { name: "Aether", raw: "Aether", recognized: false }, order: 1, teamAScore: 13, teamBScore: 7, overtime: false, qualityFlags: [] }] });
    const issues = auditMatchMaps(match, "t");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: "unknown_map" });
  });

  it("classifies a placeholder map name as unplayed_map_placeholder, distinct from unknown_map", () => {
    const match = buildNormalizedMatch({ maps: [{ map: { name: "N/A", raw: "N/A", recognized: false }, order: 3, teamAScore: null, teamBScore: null, overtime: false, qualityFlags: [] }] });
    const issues = auditMatchMaps(match, "t");
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe("unplayed_map_placeholder");
  });
});
