import { describe, expect, it } from "vitest";
import { auditMatchRosters, buildPlayerTeamAppearanceTimeline, computeRosterCompletenessScore } from "./rosterQuality";
import { buildNormalizedMatch } from "../testUtils/normalizedMatchFixture";

describe("computeRosterCompletenessScore", () => {
  it("scores a full 5/5-both-teams roster as 1.0", () => {
    expect(computeRosterCompletenessScore(buildNormalizedMatch()).score).toBe(1);
  });

  it("scores a substitution-sized roster (4 players) proportionally, never forced to 5", () => {
    const match = buildNormalizedMatch({
      rosterSnapshots: [
        { teamInternalId: "fnatic", asOf: "t", playerInternalIds: ["vlr:player:1", "vlr:player:2", "vlr:player:3", "vlr:player:4"] },
        { teamInternalId: "team-liquid", asOf: "t", playerInternalIds: ["vlr:player:6", "vlr:player:7", "vlr:player:8", "vlr:player:9", "vlr:player:10"] },
      ],
    });
    expect(computeRosterCompletenessScore(match).score).toBeCloseTo(0.9, 5);
  });
});

describe("auditMatchRosters", () => {
  it("raises no issues for a complete, valid two-team roster", () => {
    expect(auditMatchRosters(buildNormalizedMatch(), "t")).toHaveLength(0);
  });

  it("flags a duplicate player within one team's own roster", () => {
    const match = buildNormalizedMatch({
      rosterSnapshots: [
        { teamInternalId: "fnatic", asOf: "t", playerInternalIds: ["vlr:player:1", "vlr:player:1", "vlr:player:3", "vlr:player:4", "vlr:player:5"] },
        { teamInternalId: "team-liquid", asOf: "t", playerInternalIds: ["vlr:player:6", "vlr:player:7", "vlr:player:8", "vlr:player:9", "vlr:player:10"] },
      ],
    });
    const issues = auditMatchRosters(match, "t");
    expect(issues.some((i) => i.code === "duplicate_player_in_roster")).toBe(true);
  });

  it("flags a player appearing on both teams in the same match", () => {
    const match = buildNormalizedMatch({
      rosterSnapshots: [
        { teamInternalId: "fnatic", asOf: "t", playerInternalIds: ["vlr:player:1", "vlr:player:2", "vlr:player:3", "vlr:player:4", "vlr:player:5"] },
        { teamInternalId: "team-liquid", asOf: "t", playerInternalIds: ["vlr:player:1", "vlr:player:7", "vlr:player:8", "vlr:player:9", "vlr:player:10"] },
      ],
    });
    const issues = auditMatchRosters(match, "t");
    expect(issues.some((i) => i.code === "player_on_both_teams")).toBe(true);
  });

  it("flags an incomplete roster (fewer than 5) without forcing it to 5", () => {
    const match = buildNormalizedMatch({
      rosterSnapshots: [
        { teamInternalId: "fnatic", asOf: "t", playerInternalIds: ["vlr:player:1", "vlr:player:2"] },
        { teamInternalId: "team-liquid", asOf: "t", playerInternalIds: ["vlr:player:6", "vlr:player:7", "vlr:player:8", "vlr:player:9", "vlr:player:10"] },
      ],
    });
    const issues = auditMatchRosters(match, "t");
    expect(issues.some((i) => i.code === "incomplete_roster" && i.field === "fnatic")).toBe(true);
  });

  it("flags an implausible roster size (e.g. 1 player) as impossible_roster_size", () => {
    const match = buildNormalizedMatch({
      rosterSnapshots: [
        { teamInternalId: "fnatic", asOf: "t", playerInternalIds: ["vlr:player:1"] },
        { teamInternalId: "team-liquid", asOf: "t", playerInternalIds: ["vlr:player:6", "vlr:player:7", "vlr:player:8", "vlr:player:9", "vlr:player:10"] },
      ],
    });
    const issues = auditMatchRosters(match, "t");
    expect(issues.some((i) => i.code === "impossible_roster_size")).toBe(true);
  });

  it("flags a single-team roster snapshot as incomplete", () => {
    const match = buildNormalizedMatch({ rosterSnapshots: [{ teamInternalId: "fnatic", asOf: "t", playerInternalIds: ["vlr:player:1", "vlr:player:2", "vlr:player:3", "vlr:player:4", "vlr:player:5"] }] });
    const issues = auditMatchRosters(match, "t");
    expect(issues.some((i) => i.code === "incomplete_roster")).toBe(true);
  });

  it("raises nothing when no roster snapshots exist at all (already covered elsewhere)", () => {
    expect(auditMatchRosters(buildNormalizedMatch({ rosterSnapshots: undefined }), "t")).toHaveLength(0);
  });
});

describe("buildPlayerTeamAppearanceTimeline", () => {
  it("orders appearances by timestamp then match ID, deterministically", () => {
    const matchA = buildNormalizedMatch({ internalId: "vlr:match:2", scheduledAt: { iso: "2025-01-02T00:00:00.000Z", raw: "r", confidence: "high" } });
    const matchB = buildNormalizedMatch({ internalId: "vlr:match:1", scheduledAt: { iso: "2025-01-01T00:00:00.000Z", raw: "r", confidence: "high" } });
    // roster asOf drives ordering, not scheduledAt.
    const timeline = buildPlayerTeamAppearanceTimeline([
      { ...matchA, rosterSnapshots: matchA.rosterSnapshots!.map((r) => ({ ...r, asOf: "2025-01-02T00:00:00.000Z" })) },
      { ...matchB, rosterSnapshots: matchB.rosterSnapshots!.map((r) => ({ ...r, asOf: "2025-01-01T00:00:00.000Z" })) },
    ]);
    expect(timeline[0]!.matchInternalId).toBe("vlr:match:1");
    expect(timeline[timeline.length - 1]!.matchInternalId).toBe("vlr:match:2");
  });

  it("never infers a player's team membership beyond an observed roster snapshot", () => {
    const timeline = buildPlayerTeamAppearanceTimeline([buildNormalizedMatch()]);
    expect(timeline.every((a) => a.matchInternalId === "vlr:match:1")).toBe(true);
    expect(timeline).toHaveLength(10);
  });
});
