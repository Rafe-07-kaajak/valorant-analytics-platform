import { describe, expect, it } from "vitest";
import { countMapWins, validateMapScore } from "./scoreValidation";
import type { VlrMapResult } from "../vlr/schemas/raw";

function map(overrides: Partial<VlrMapResult>): VlrMapResult {
  return { mapNameRaw: "Ascent", order: 1, teamAScore: 13, teamBScore: 9, overtime: false, ...overrides };
}

describe("validateMapScore", () => {
  it("flags an unplayed map (null scores) distinctly from a 0-0 result", () => {
    const flags = validateMapScore(map({ teamAScore: null, teamBScore: null }));
    expect(flags).toHaveLength(1);
    expect(flags[0]?.code).toBe("missing_map_score");
  });

  it("does not flag a genuine 0-0 in-progress score as missing", () => {
    const flags = validateMapScore(map({ teamAScore: 0, teamBScore: 0, winnerVlrTeamId: undefined }));
    expect(flags).toHaveLength(0);
  });

  it("flags a tied score that still has a winner flagged", () => {
    const flags = validateMapScore(map({ teamAScore: 10, teamBScore: 10, winnerVlrTeamId: "2593" }));
    expect(flags[0]?.code).toBe("inconsistent_winner");
  });

  it("passes a clean, consistent completed map", () => {
    expect(validateMapScore(map({ winnerVlrTeamId: "2593" }))).toHaveLength(0);
  });
});

describe("countMapWins", () => {
  it("counts wins for each team by winner ID", () => {
    const maps = [map({ order: 1, winnerVlrTeamId: "A" }), map({ order: 2, winnerVlrTeamId: "B" }), map({ order: 3, winnerVlrTeamId: "A" })];
    expect(countMapWins(maps, "A", "B")).toEqual({ teamAWins: 2, teamBWins: 1 });
  });

  it("does not count an unplayed map with no winner", () => {
    const maps = [map({ winnerVlrTeamId: "A" }), map({ teamAScore: null, teamBScore: null, winnerVlrTeamId: undefined })];
    expect(countMapWins(maps, "A", "B")).toEqual({ teamAWins: 1, teamBWins: 0 });
  });
});
