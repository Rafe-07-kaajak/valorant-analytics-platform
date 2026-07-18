import { describe, expect, it } from "vitest";
import { auditMatchScoreConsistency } from "./scoreConsistency";
import { buildNormalizedMatch } from "../testUtils/normalizedMatchFixture";

describe("auditMatchScoreConsistency", () => {
  it("raises no issues for a structurally valid completed Bo3", () => {
    expect(auditMatchScoreConsistency(buildNormalizedMatch(), "t")).toHaveLength(0);
  });

  it("flags a winner that matches neither competing team", () => {
    const match = buildNormalizedMatch({ winnerId: "some-other-team" });
    const issues = auditMatchScoreConsistency(match, "t");
    expect(issues.some((i) => i.code === "inconsistent_series_winner")).toBe(true);
  });

  it("flags a map winner that contradicts its own score", () => {
    const match = buildNormalizedMatch({
      maps: [{ map: { name: "Ascent", raw: "Ascent", recognized: true }, order: 1, teamAScore: 7, teamBScore: 13, winnerInternalTeamId: "fnatic", overtime: false, qualityFlags: [] }],
    });
    const issues = auditMatchScoreConsistency(match, "t");
    expect(issues.some((i) => i.code === "inconsistent_map_winner")).toBe(true);
  });

  it("flags a tied map score that still records a winner", () => {
    const match = buildNormalizedMatch({
      maps: [{ map: { name: "Ascent", raw: "Ascent", recognized: true }, order: 1, teamAScore: 13, teamBScore: 13, winnerInternalTeamId: "fnatic", overtime: false, qualityFlags: [] }],
    });
    const issues = auditMatchScoreConsistency(match, "t");
    expect(issues.some((i) => i.code === "inconsistent_map_winner")).toBe(true);
  });

  it("flags a negative score as invalid_score", () => {
    const match = buildNormalizedMatch({
      maps: [{ map: { name: "Ascent", raw: "Ascent", recognized: true }, order: 1, teamAScore: -1, teamBScore: 13, overtime: false, qualityFlags: [] }],
    });
    const issues = auditMatchScoreConsistency(match, "t");
    expect(issues.some((i) => i.code === "invalid_score")).toBe(true);
  });

  it("flags a series win count that isn't valid for the declared format as a forfeit (completed, some maps played)", () => {
    const match = buildNormalizedMatch({
      seriesFormat: "bo3",
      maps: [{ map: { name: "Ascent", raw: "Ascent", recognized: true }, order: 1, teamAScore: 13, teamBScore: 7, winnerInternalTeamId: "fnatic", overtime: false, qualityFlags: [] }],
    });
    const issues = auditMatchScoreConsistency(match, "t");
    expect(issues.some((i) => i.code === "forfeit")).toBe(true);
  });

  it("does not audit a non-completed match", () => {
    const match = buildNormalizedMatch({ status: "postponed", winnerId: null });
    expect(auditMatchScoreConsistency(match, "t")).toHaveLength(0);
  });
});
