import { describe, expect, it } from "vitest";
import { buildNormalizedMatch } from "../testUtils/normalizedMatchFixture";
import { actuallyPlayedMaps, extractPlayedMapInstancesForTeam, isMapActuallyPlayed } from "./mapInstances";

describe("isMapActuallyPlayed", () => {
  it("excludes unplayed placeholders regardless of score", () => {
    expect(isMapActuallyPlayed({ map: { name: "N/A", raw: "N/A", recognized: false }, order: 1, teamAScore: null, teamBScore: null, overtime: false, qualityFlags: [] })).toBe(false);
    expect(isMapActuallyPlayed({ map: { name: "TBD", raw: "TBD", recognized: false }, order: 1, teamAScore: 13, teamBScore: 7, overtime: false, qualityFlags: [] })).toBe(false);
  });

  it("excludes a real map with a null score (not played)", () => {
    expect(isMapActuallyPlayed({ map: { name: "Ascent", raw: "Ascent", recognized: true }, order: 1, teamAScore: null, teamBScore: null, overtime: false, qualityFlags: [] })).toBe(false);
  });

  it("includes a real map with both scores present, recognized or not", () => {
    expect(isMapActuallyPlayed({ map: { name: "Ascent", raw: "Ascent", recognized: true }, order: 1, teamAScore: 13, teamBScore: 7, overtime: false, qualityFlags: [] })).toBe(true);
    expect(isMapActuallyPlayed({ map: { name: "Summit", raw: "Summit", recognized: false }, order: 1, teamAScore: 13, teamBScore: 7, overtime: false, qualityFlags: [] })).toBe(true);
  });
});

describe("extractPlayedMapInstancesForTeam", () => {
  it("orients scores to the requested team's perspective", () => {
    const match = buildNormalizedMatch({
      teamAId: "fnatic",
      teamBId: "team-liquid",
      maps: [{ map: { name: "Ascent", raw: "Ascent", recognized: true }, order: 1, teamAScore: 13, teamBScore: 7, teamAAttackScore: 8, teamBDefenseScore: 5, teamBAttackScore: 2, teamADefenseScore: 5, winnerInternalTeamId: "fnatic", overtime: false, qualityFlags: [] }],
    });
    const teamAInstances = extractPlayedMapInstancesForTeam(match, "teamA");
    expect(teamAInstances[0]!.teamScore).toBe(13);
    expect(teamAInstances[0]!.opponentScore).toBe(7);
    expect(teamAInstances[0]!.teamAttackScore).toBe(8);

    const teamBInstances = extractPlayedMapInstancesForTeam(match, "teamB");
    expect(teamBInstances[0]!.teamScore).toBe(7);
    expect(teamBInstances[0]!.opponentScore).toBe(13);
    expect(teamBInstances[0]!.teamAttackScore).toBe(2);
  });

  it("excludes unplayed maps from both teams' instance lists", () => {
    const match = buildNormalizedMatch({
      maps: [
        { map: { name: "Ascent", raw: "Ascent", recognized: true }, order: 1, teamAScore: 13, teamBScore: 7, winnerInternalTeamId: "fnatic", overtime: false, qualityFlags: [] },
        { map: { name: "N/A", raw: "N/A", recognized: false }, order: 2, teamAScore: null, teamBScore: null, overtime: false, qualityFlags: [] },
      ],
    });
    expect(actuallyPlayedMaps(match)).toHaveLength(1);
    expect(extractPlayedMapInstancesForTeam(match, "teamA")).toHaveLength(1);
  });
});
