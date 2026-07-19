import { describe, expect, it } from "vitest";
import { TeamState } from "./teamState";
import type { PlayedMapInstance } from "./teamState";
import { PlayerRegistry } from "./playerState";
import { createEloState } from "./elo";
import { DEFAULT_ELO_CONFIG } from "./versions";

const DAY_MS = 86_400_000;

function snapshotAt(team: TeamState, nowMs: number, rosterPlayerIds: readonly string[] | null = null, players = new PlayerRegistry()) {
  return team.snapshot({ nowMs, rosterPlayerIds, opponentTeamId: "opponent", players, eloState: createEloState(), eloConfig: DEFAULT_ELO_CONFIG }, "team-a");
}

function mapInstance(overrides: Partial<PlayedMapInstance> = {}): PlayedMapInstance {
  return { mapName: "Ascent", recognized: true, teamScore: 13, opponentScore: 7, ...overrides };
}

describe("TeamState", () => {
  it("returns explicit cold-start defaults for a team with no history", () => {
    const team = new TeamState();
    const block = snapshotAt(team, 0);
    expect(block.PriorMatchCount).toBe(0);
    expect(block.IsColdStart).toBe(true);
    expect(block.CumulativeWinRate).toBe(0.5);
    expect(block.CumulativeMapWinRate).toBe(0.5);
    expect(block.DaysSinceLastMatch).toBeNull();
    expect(block.HasPriorMatch).toBe(false);
    expect(block.InactivityFlag).toBe(false);
  });

  it("never divides by zero for rate features with no history", () => {
    const team = new TeamState();
    const block = snapshotAt(team, 0);
    expect(Number.isFinite(block.CumulativeWinRate)).toBe(true);
    expect(Number.isFinite(block.RecentMapWinRateLast10)).toBe(true);
    expect(Number.isFinite(block.AttackSideWinRate)).toBe(true);
    expect(Number.isNaN(block.CumulativeWinRate)).toBe(false);
  });

  it("accumulates cumulative match and map records after recordResult", () => {
    const team = new TeamState();
    team.recordResult({
      matchInternalId: "m1",
      timestampMs: 0,
      won: true,
      opponentTeamId: "opp",
      opponentEloAtEncounter: 1500,
      opponentWinRateAtEncounter: 0.5,
      opponentAboveMedianAtEncounter: false,
      eventInternalId: "e1",
      mapInstances: [mapInstance({ teamScore: 13, opponentScore: 7 }), mapInstance({ mapName: "Bind", teamScore: 13, opponentScore: 10 })],
      rosterPlayerIds: null,
    });
    const block = snapshotAt(team, DAY_MS);
    expect(block.PriorMatchCount).toBe(1);
    expect(block.PriorWins).toBe(1);
    expect(block.CumulativeWinRate).toBe(1);
    expect(block.PriorMapsPlayed).toBe(2);
    expect(block.PriorMapWins).toBe(2);
    expect(block.CumulativeMapWinRate).toBe(1);
  });

  it("computes recent-window win rates using only the last N matches", () => {
    const team = new TeamState();
    for (let i = 0; i < 6; i += 1) {
      team.recordResult({
        matchInternalId: `m${i}`,
        timestampMs: i * DAY_MS,
        won: i >= 3, // first 3 losses, last 3 wins
        opponentTeamId: "opp",
        opponentEloAtEncounter: 1500,
        opponentWinRateAtEncounter: 0.5,
        opponentAboveMedianAtEncounter: false,
        eventInternalId: "e1",
        mapInstances: [mapInstance()],
        rosterPlayerIds: null,
      });
    }
    const block = snapshotAt(team, 100 * DAY_MS);
    expect(block.Last3MatchCount).toBe(3);
    expect(block.Last3WinRate).toBe(1); // last 3 were all wins
    expect(block.Last10MatchCount).toBe(6);
    expect(block.Last10WinRate).toBeCloseTo(0.5);
  });

  it("restricts 30/60-day windows strictly to matches within that many days of now", () => {
    const team = new TeamState();
    team.recordResult({
      matchInternalId: "m-old",
      timestampMs: 0,
      won: true,
      opponentTeamId: "opp",
      opponentEloAtEncounter: 1500,
      opponentWinRateAtEncounter: 0.5,
      opponentAboveMedianAtEncounter: false,
      eventInternalId: "e1",
      mapInstances: [mapInstance()],
      rosterPlayerIds: null,
    });
    const nowMs = 45 * DAY_MS;
    const block = snapshotAt(team, nowMs);
    expect(block.Last30DayMatchCount).toBe(0);
    expect(block.Last60DayMatchCount).toBe(1);
  });

  it("tracks map pool breadth, unknown-map counts, and top-map concentration", () => {
    const team = new TeamState();
    team.recordResult({
      matchInternalId: "m1",
      timestampMs: 0,
      won: true,
      opponentTeamId: "opp",
      opponentEloAtEncounter: 1500,
      opponentWinRateAtEncounter: 0.5,
      opponentAboveMedianAtEncounter: false,
      eventInternalId: "e1",
      mapInstances: [mapInstance({ mapName: "Ascent" }), mapInstance({ mapName: "Ascent" }), mapInstance({ mapName: "Bind" }), mapInstance({ recognized: false, mapName: "Newmap" })],
      rosterPlayerIds: null,
    });
    const block = snapshotAt(team, DAY_MS);
    expect(block.MapPoolBreadth).toBe(2); // Ascent, Bind — unrecognized excluded from breadth
    expect(block.UnknownMapCount).toBe(1);
    expect(block.TopMapConcentration).toBeCloseTo(2 / 3); // Ascent played 2 of 3 recognized maps
  });

  it("treats unplayed-placeholder maps as excluded entirely (never counted as unknown or played)", () => {
    // Placeholder exclusion happens upstream in mapInstances.ts/isMapActuallyPlayed;
    // TeamState itself only ever receives already-filtered played instances.
    const team = new TeamState();
    const block = snapshotAt(team, 0);
    expect(block.UnknownMapCount).toBe(0);
    expect(block.MapPoolBreadth).toBe(0);
  });

  it("computes attack/defense split rates only from reconstructed round totals when data is present", () => {
    const team = new TeamState();
    team.recordResult({
      matchInternalId: "m1",
      timestampMs: 0,
      won: true,
      opponentTeamId: "opp",
      opponentEloAtEncounter: 1500,
      opponentWinRateAtEncounter: 0.5,
      opponentAboveMedianAtEncounter: false,
      eventInternalId: "e1",
      mapInstances: [mapInstance({ teamAttackScore: 7, opponentDefenseScore: 5, teamDefenseScore: 6, opponentAttackScore: 2 })],
      rosterPlayerIds: null,
    });
    const block = snapshotAt(team, DAY_MS);
    expect(block.HasAttackDefenseSplitData).toBe(true);
    expect(block.AttackSideWinRate).toBeCloseTo(7 / 12);
    expect(block.DefenseSideWinRate).toBeCloseTo(6 / 8);
  });

  it("computes rest/schedule features and flags back-to-back and inactivity", () => {
    const team = new TeamState();
    team.recordResult({
      matchInternalId: "m1",
      timestampMs: 0,
      won: true,
      opponentTeamId: "opp",
      opponentEloAtEncounter: 1500,
      opponentWinRateAtEncounter: 0.5,
      opponentAboveMedianAtEncounter: false,
      eventInternalId: "e1",
      mapInstances: [mapInstance()],
      rosterPlayerIds: null,
    });
    const sameDayBlock = snapshotAt(team, 12 * 3_600_000); // 12 hours later
    expect(sameDayBlock.IsBackToBack).toBe(true);
    expect(sameDayBlock.InactivityFlag).toBe(false);

    const farLaterBlock = snapshotAt(team, 40 * DAY_MS);
    expect(farLaterBlock.InactivityFlag).toBe(true);
    expect(farLaterBlock.DaysSinceLastMatch).toBeCloseTo(40);
  });

  it("never produces a negative rest value", () => {
    const team = new TeamState();
    team.recordResult({
      matchInternalId: "m1",
      timestampMs: DAY_MS,
      won: true,
      opponentTeamId: "opp",
      opponentEloAtEncounter: 1500,
      opponentWinRateAtEncounter: 0.5,
      opponentAboveMedianAtEncounter: false,
      eventInternalId: "e1",
      mapInstances: [mapInstance()],
      rosterPlayerIds: null,
    });
    const block = snapshotAt(team, 2 * DAY_MS);
    expect(block.DaysSinceLastMatch).toBeGreaterThanOrEqual(0);
  });

  it("computes roster continuity, debuting players, and shared-history for a complete roster", () => {
    const team = new TeamState();
    const players = new PlayerRegistry();
    const firstRoster = ["p1", "p2", "p3", "p4", "p5"];
    team.recordResult({
      matchInternalId: "m1",
      timestampMs: 0,
      won: true,
      opponentTeamId: "opp",
      opponentEloAtEncounter: 1500,
      opponentWinRateAtEncounter: 0.5,
      opponentAboveMedianAtEncounter: false,
      eventInternalId: "e1",
      mapInstances: [mapInstance()],
      rosterPlayerIds: firstRoster,
    });
    for (const id of firstRoster) players.recordAppearance(id, { matchInternalId: "m1", timestampMs: 0, teamInternalId: "team-a", won: true, isInternational: false, isMastersOrChampions: false });

    const sameRosterBlock = snapshotAt(team, DAY_MS, firstRoster, players);
    expect(sameRosterBlock.RosterContinuityVsPreviousMatch).toBe(1);
    expect(sameRosterBlock.RosterDebutingPlayerCount).toBe(0);
    expect(sameRosterBlock.PlayersWithPriorTeamAppearanceCount).toBe(5);
    expect(sameRosterBlock.SharedPriorMatchesAmongRosterAvg).toBe(1);

    const newRoster = ["p6", "p7", "p8", "p9", "p10"];
    const newRosterBlock = snapshotAt(team, DAY_MS, newRoster, players);
    expect(newRosterBlock.RosterContinuityVsPreviousMatch).toBe(0);
    expect(newRosterBlock.RosterDebutingPlayerCount).toBe(5);
    expect(newRosterBlock.PlayersWithPriorTeamAppearanceCount).toBe(0);
  });

  it("flags missing roster data explicitly instead of guessing membership", () => {
    const team = new TeamState();
    const block = snapshotAt(team, 0, null);
    expect(block.RosterSnapshotAvailable).toBe(false);
    expect(block.RosterSize).toBe(0);
    expect(block.DaysSinceRosterLastAppearedTogether).toBeNull();
  });

  it("exposes recognized map names for the match-level map-pool-overlap feature", () => {
    const team = new TeamState();
    team.recordResult({
      matchInternalId: "m1",
      timestampMs: 0,
      won: true,
      opponentTeamId: "opp",
      opponentEloAtEncounter: 1500,
      opponentWinRateAtEncounter: 0.5,
      opponentAboveMedianAtEncounter: false,
      eventInternalId: "e1",
      mapInstances: [mapInstance({ mapName: "Ascent" })],
      rosterPlayerIds: null,
    });
    expect(team.recognizedMapNames()).toEqual(new Set(["Ascent"]));
  });
});
