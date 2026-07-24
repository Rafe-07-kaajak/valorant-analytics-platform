import { describe, expect, it } from "vitest";
import { buildMockFeatureRow } from "../modeling/testUtils/mockFeatureRow";
import { buildTeamRealDataStates } from "./teamRealDataState";
import type { CanonicalWindow } from "./canonicalWindow";

const WINDOW: CanonicalWindow = {
  windowStartIso: "2025-06-07T12:00:00.000Z",
  sourceEventInternalId: "vlr:event:2282",
  sourceEventName: "Valorant Masters Toronto 2025",
};

describe("buildTeamRealDataStates", () => {
  it("excludes rows strictly before the canonical window", () => {
    const row = buildMockFeatureRow({ teamAProviderId: "team-a", teamBProviderId: "team-b", scheduledAt: "2025-01-01T00:00:00.000Z" });
    const states = buildTeamRealDataStates([row], WINDOW);
    expect(states.size).toBe(0);
  });

  it("includes a row exactly at the window start (inclusive boundary)", () => {
    const row = buildMockFeatureRow({ teamAProviderId: "team-a", teamBProviderId: "team-b", scheduledAt: WINDOW.windowStartIso });
    const states = buildTeamRealDataStates([row], WINDOW);
    expect(states.size).toBe(2);
  });

  it("uses the team's most recent eligible row for eloRating/recentFormIndex", () => {
    const early = buildMockFeatureRow({
      matchInternalId: "vlr:match:1",
      teamAProviderId: "team-a",
      teamBProviderId: "team-b",
      scheduledAt: "2025-07-01T00:00:00.000Z",
      teamAEloRating: 1400,
      teamALast10WinRate: 0.3,
      teamALast10MatchCount: 5,
    });
    const late = buildMockFeatureRow({
      matchInternalId: "vlr:match:2",
      teamAProviderId: "team-a",
      teamBProviderId: "team-c",
      scheduledAt: "2026-01-01T00:00:00.000Z",
      teamAEloRating: 1650,
      teamALast10WinRate: 0.8,
      teamALast10MatchCount: 8,
    });

    const states = buildTeamRealDataStates([early, late], WINDOW);
    const teamA = states.get("team-a")!;
    expect(teamA.eloRating).toBe(1650);
    expect(teamA.recentFormIndex).toBeCloseTo(80, 5);
    expect(teamA.seriesCountInWindow).toBe(2);
  });

  it("falls back to cumulativeWinRate for recentFormIndex when the team has no last-10 matches yet", () => {
    const row = buildMockFeatureRow({
      teamAProviderId: "team-a",
      teamBProviderId: "team-b",
      scheduledAt: WINDOW.windowStartIso,
      teamALast10MatchCount: 0,
      teamACumulativeWinRate: 0.6,
    });
    const states = buildTeamRealDataStates([row], WINDOW);
    expect(states.get("team-a")!.recentFormIndex).toBeCloseTo(60, 5);
  });

  it("gives a team with zero eligible rows no entry at all (never a neutral default)", () => {
    const states = buildTeamRealDataStates([], WINDOW);
    expect(states.has("team-a")).toBe(false);
    expect(states.size).toBe(0);
  });

  it("weighs competitionTier across the team's whole in-window series, not just the latest row", () => {
    const mastersRow = buildMockFeatureRow({
      matchInternalId: "vlr:match:1",
      teamAProviderId: "team-a",
      teamBProviderId: "team-b",
      scheduledAt: "2025-07-01T00:00:00.000Z",
      isMastersOrChampions: true,
      isInternationalEvent: true,
      isRegionalLeague: false,
    });
    const regionalRow = buildMockFeatureRow({
      matchInternalId: "vlr:match:2",
      teamAProviderId: "team-a",
      teamBProviderId: "team-c",
      scheduledAt: "2026-01-01T00:00:00.000Z",
      isMastersOrChampions: false,
      isInternationalEvent: false,
      isRegionalLeague: true,
    });

    const states = buildTeamRealDataStates([mastersRow, regionalRow], WINDOW);
    // (1.0 + 0.3) / 2 * 100 = 65
    expect(states.get("team-a")!.competitionTier).toBeCloseTo(65, 5);
  });

  it("rescales opponentAdjusted around the Elo midpoint (1500) onto a 0-100 band", () => {
    const strongScheduleRow = buildMockFeatureRow({ teamAProviderId: "team-a", teamBProviderId: "team-b", scheduledAt: WINDOW.windowStartIso, teamAAvgOpponentEloLast10: 1900 });
    const weakScheduleRow = buildMockFeatureRow({ teamAProviderId: "team-x", teamBProviderId: "team-y", scheduledAt: WINDOW.windowStartIso, teamAAvgOpponentEloLast10: 1100 });

    const states = buildTeamRealDataStates([strongScheduleRow, weakScheduleRow], WINDOW);
    expect(states.get("team-a")!.opponentAdjusted).toBe(100);
    expect(states.get("team-x")!.opponentAdjusted).toBe(0);
  });

  it("never produces NaN or Infinity even for extreme/zero-sample inputs", () => {
    const row = buildMockFeatureRow({
      teamAProviderId: "team-a",
      teamBProviderId: "team-b",
      scheduledAt: WINDOW.windowStartIso,
      teamAEloRating: Number.NaN,
      teamAAvgRoundsWonPerMap: -50,
      teamAMapPoolBreadth: 999,
    });
    const state = buildTeamRealDataStates([row], WINDOW).get("team-a")!;
    for (const value of [state.recentFormIndex, state.mapDepthScore, state.consistency, state.opponentAdjusted, state.competitionTier]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});
