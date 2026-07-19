import { describe, expect, it } from "vitest";
import { buildNormalizedMatch } from "../testUtils/normalizedMatchFixture";
import { buildMatchLabels } from "./labels";

describe("buildMatchLabels", () => {
  it("labels team A win as 1 when team A is the winner", () => {
    const match = buildNormalizedMatch({ teamAId: "fnatic", teamBId: "team-liquid", winnerId: "fnatic" });
    const result = buildMatchLabels(match);
    expect(result.valid).toBe(true);
    expect(result.labels!.labelTeamAWin).toBe(1);
    expect(result.labels!.labelWinnerProviderId).toBe("fnatic");
  });

  it("labels team A win as 0 when team B is the winner", () => {
    const match = buildNormalizedMatch({ teamAId: "fnatic", teamBId: "team-liquid", winnerId: "team-liquid" });
    const result = buildMatchLabels(match);
    expect(result.valid).toBe(true);
    expect(result.labels!.labelTeamAWin).toBe(0);
  });

  it("rejects a match whose winner is neither team A nor team B", () => {
    const match = buildNormalizedMatch({ teamAId: "fnatic", teamBId: "team-liquid", winnerId: "some-other-team" });
    const result = buildMatchLabels(match);
    expect(result.valid).toBe(false);
  });

  it("rejects a match with no recorded winner", () => {
    const match = buildNormalizedMatch({ winnerId: null });
    const result = buildMatchLabels(match);
    expect(result.valid).toBe(false);
  });

  it("counts only actually-played maps toward labelMapCountPlayed and labelSeriesScore", () => {
    const match = buildNormalizedMatch({
      teamAId: "fnatic",
      teamBId: "team-liquid",
      winnerId: "fnatic",
      maps: [
        { map: { name: "Ascent", raw: "Ascent", recognized: true }, order: 1, teamAScore: 13, teamBScore: 7, winnerInternalTeamId: "fnatic", overtime: false, qualityFlags: [] },
        { map: { name: "Bind", raw: "Bind", recognized: true }, order: 2, teamAScore: 13, teamBScore: 10, winnerInternalTeamId: "fnatic", overtime: false, qualityFlags: [] },
        { map: { name: "N/A", raw: "N/A", recognized: false }, order: 3, teamAScore: null, teamBScore: null, overtime: false, qualityFlags: [] },
      ],
    });
    const result = buildMatchLabels(match);
    expect(result.labels!.labelMapCountPlayed).toBe(2);
    expect(result.labels!.labelSeriesScore).toBe("2-0");
  });

  it("never exposes a label field with the same name as a feature — label/feature separation", () => {
    const match = buildNormalizedMatch();
    const result = buildMatchLabels(match);
    const labelKeys = Object.keys(result.labels!);
    expect(labelKeys.every((k) => k.startsWith("label"))).toBe(true);
  });
});
