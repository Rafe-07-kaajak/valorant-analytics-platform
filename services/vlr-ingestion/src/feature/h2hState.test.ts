import { describe, expect, it } from "vitest";
import { HeadToHeadRegistry } from "./h2hState";

const DAY_MS = 86_400_000;

describe("HeadToHeadRegistry", () => {
  it("reports zero prior meetings for a fresh pairing", () => {
    const registry = new HeadToHeadRegistry();
    const snap = registry.snapshot("team-a", "team-b", 0, "vct-americas", "americas");
    expect(snap.priorMeetingCount).toBe(0);
    expect(snap.teamAWinRate).toBe(0.5);
    expect(snap.mostRecentMeetingWinnerProviderId).toBe("unknown");
  });

  it("counts a prior meeting and orients wins/map differential to the current match's team A/B", () => {
    const registry = new HeadToHeadRegistry();
    registry.recordResult({ timestampMs: 0, teamAId: "team-a", teamBId: "team-b", winnerTeamId: "team-a", mapsWonByTeamA: 2, mapsWonByTeamB: 1, eventFamily: "vct-americas", eventRegion: "americas" });

    const sameOrientation = registry.snapshot("team-a", "team-b", DAY_MS, "vct-americas", "americas");
    expect(sameOrientation.priorMeetingCount).toBe(1);
    expect(sameOrientation.teamAWins).toBe(1);
    expect(sameOrientation.priorMapDifferential).toBe(1);

    const reversedOrientation = registry.snapshot("team-b", "team-a", DAY_MS, "vct-americas", "americas");
    expect(reversedOrientation.teamAWins).toBe(0);
    expect(reversedOrientation.teamBWins).toBe(1);
    expect(reversedOrientation.priorMapDifferential).toBe(-1);
  });

  it("recognizes a rematch as distinct from the same pair's earlier meeting, keeping both in history", () => {
    const registry = new HeadToHeadRegistry();
    registry.recordResult({ timestampMs: 0, teamAId: "team-a", teamBId: "team-b", winnerTeamId: "team-a", mapsWonByTeamA: 2, mapsWonByTeamB: 0, eventFamily: "vct-americas", eventRegion: "americas" });
    registry.recordResult({ timestampMs: DAY_MS, teamAId: "team-b", teamBId: "team-a", winnerTeamId: "team-b", mapsWonByTeamA: 2, mapsWonByTeamB: 1, eventFamily: "vct-americas", eventRegion: "americas" });

    const snap = registry.snapshot("team-a", "team-b", 2 * DAY_MS, "vct-americas", "americas");
    expect(snap.priorMeetingCount).toBe(2);
    expect(snap.teamAWins).toBe(1);
    expect(snap.teamBWins).toBe(1);
    expect(snap.mostRecentMeetingWinnerProviderId).toBe("team-b");
  });

  it("does not include the current meeting in its own snapshot (recordResult only applied after emission)", () => {
    const registry = new HeadToHeadRegistry();
    const preMatchSnapshot = registry.snapshot("team-a", "team-b", 0, "vct-americas", "americas");
    registry.recordResult({ timestampMs: 0, teamAId: "team-a", teamBId: "team-b", winnerTeamId: "team-a", mapsWonByTeamA: 2, mapsWonByTeamB: 0, eventFamily: "vct-americas", eventRegion: "americas" });
    expect(preMatchSnapshot.priorMeetingCount).toBe(0);
  });

  it("respects the 90/180/365-day recency windows", () => {
    const registry = new HeadToHeadRegistry();
    registry.recordResult({ timestampMs: 0, teamAId: "team-a", teamBId: "team-b", winnerTeamId: "team-a", mapsWonByTeamA: 2, mapsWonByTeamB: 0, eventFamily: "vct-americas", eventRegion: "americas" });
    const nowMs = 100 * DAY_MS;
    const snap = registry.snapshot("team-a", "team-b", nowMs, "vct-americas", "americas");
    expect(snap.meetingsLast90Days).toBe(0);
    expect(snap.meetingsLast180Days).toBe(1);
    expect(snap.meetingsLast365Days).toBe(1);
  });

  it("counts meetings in the same event family and same event region separately", () => {
    const registry = new HeadToHeadRegistry();
    registry.recordResult({ timestampMs: 0, teamAId: "team-a", teamBId: "team-b", winnerTeamId: "team-a", mapsWonByTeamA: 2, mapsWonByTeamB: 0, eventFamily: "vct-americas", eventRegion: "americas" });
    registry.recordResult({ timestampMs: DAY_MS, teamAId: "team-a", teamBId: "team-b", winnerTeamId: "team-a", mapsWonByTeamA: 2, mapsWonByTeamB: 1, eventFamily: "masters", eventRegion: "unknown" });

    const snap = registry.snapshot("team-a", "team-b", 2 * DAY_MS, "vct-americas", "americas");
    expect(snap.meetingsSameEventFamily).toBe(1);
    expect(snap.meetingsSameEventRegion).toBe(1);
  });
});
