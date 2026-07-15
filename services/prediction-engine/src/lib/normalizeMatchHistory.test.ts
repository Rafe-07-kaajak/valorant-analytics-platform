import { describe, expect, it } from "vitest";
import type { RawMatchRecord } from "../data/matchHistory";
import { validateMatchHistory } from "./validateMatchHistory";
import { normalizedMatchHistory, normalizeMatchHistory } from "./normalizeMatchHistory";

function economyBucket(roundsPlayed: number, roundsWon: number) {
  return { roundsPlayed, roundsWon };
}

/**
 * Two hand-built matches for "teamX": a 13-8 win over "teamY" on "ascent",
 * and a 10-13 loss to "teamZ" on "haven". Every count below is chosen so the
 * expected aggregate values can be computed by hand in the assertions.
 */
const matchOne: RawMatchRecord = {
  matchId: "fixture:1",
  mapId: "ascent",
  playedAt: "2025-01-01T00:00:00.000Z",
  teamA: {
    teamId: "teamX",
    roundsWon: 13,
    firstKills: 12,
    economy: {
      eco: economyBucket(5, 3),
      force: economyBucket(6, 4),
      fullBuy: economyBucket(10, 6),
    },
    clutches: { situationsFaced: 2, situationsWon: 1 },
  },
  teamB: {
    teamId: "teamY",
    roundsWon: 8,
    firstKills: 9,
    economy: {
      eco: economyBucket(5, 2),
      force: economyBucket(6, 2),
      fullBuy: economyBucket(10, 4),
    },
    clutches: { situationsFaced: 1, situationsWon: 0 },
  },
};

const matchTwo: RawMatchRecord = {
  matchId: "fixture:2",
  mapId: "haven",
  playedAt: "2025-01-02T00:00:00.000Z",
  teamA: {
    teamId: "teamX",
    roundsWon: 10,
    firstKills: 11,
    economy: {
      eco: economyBucket(4, 1),
      force: economyBucket(7, 3),
      fullBuy: economyBucket(12, 6),
    },
    clutches: { situationsFaced: 3, situationsWon: 2 },
  },
  teamB: {
    teamId: "teamZ",
    roundsWon: 13,
    firstKills: 12,
    economy: {
      eco: economyBucket(4, 3),
      force: economyBucket(7, 4),
      fullBuy: economyBucket(12, 6),
    },
    clutches: { situationsFaced: 2, situationsWon: 1 },
  },
};

describe("normalizeMatchHistory", () => {
  it("computes every teamX aggregate by hand against the fixture dataset", () => {
    const result = normalizeMatchHistory([matchOne, matchTwo]);
    const teamX = result.teams.teamX!;

    expect(teamX.matchesPlayed).toBe(2);
    expect(teamX.matchIds).toEqual(["fixture:1", "fixture:2"]);

    // 1 win out of 2 matches (13-8 win, 10-13 loss).
    expect(teamX.overallWinRate).toBeCloseTo(0.5, 10);

    // Round differential: (13-8) = 5, (10-13) = -3 -> average 1.
    expect(teamX.averageRoundDifferential).toBeCloseTo(1, 10);

    // Round win rate: (13 + 10) rounds won out of (21 + 23) rounds played.
    expect(teamX.roundWinRate).toBeCloseTo(23 / 44, 10);

    // Economy: eco 4/9, force 7/13, fullBuy 12/22.
    expect(teamX.economyOutcomeRates.eco).toBeCloseTo(4 / 9, 10);
    expect(teamX.economyOutcomeRates.force).toBeCloseTo(7 / 13, 10);
    expect(teamX.economyOutcomeRates.fullBuy).toBeCloseTo(12 / 22, 10);

    // Entry success: (12 + 11) first kills out of (21 + 23) total rounds.
    expect(teamX.entrySuccessRate).toBeCloseTo(23 / 44, 10);

    // Clutches: (1 + 2) won out of (2 + 3) faced.
    expect(teamX.clutchConversionRate).toBeCloseTo(3 / 5, 10);

    expect(teamX.recentForm.last5).toEqual({ matchesConsidered: 2, wins: 1, winRate: 0.5 });
    expect(teamX.recentForm.last10).toEqual({ matchesConsidered: 2, wins: 1, winRate: 0.5 });

    expect(teamX.mapPerformance.ascent).toEqual({ mapId: "ascent", matchesPlayed: 1, wins: 1, winRate: 1 });
    expect(teamX.mapPerformance.haven).toEqual({ mapId: "haven", matchesPlayed: 1, wins: 0, winRate: 0 });
  });

  it("reports insufficient data as null rather than a misleading zero", () => {
    const result = normalizeMatchHistory([]);
    const teamWithNoMatches = result.teams.sen!;

    expect(teamWithNoMatches.matchesPlayed).toBe(0);
    expect(teamWithNoMatches.overallWinRate).toBeNull();
    expect(teamWithNoMatches.averageRoundDifferential).toBeNull();
    expect(teamWithNoMatches.roundWinRate).toBeNull();
    expect(teamWithNoMatches.entrySuccessRate).toBeNull();
    expect(teamWithNoMatches.clutchConversionRate).toBeNull();
    expect(teamWithNoMatches.economyOutcomeRates).toEqual({ eco: null, force: null, fullBuy: null });
    expect(teamWithNoMatches.recentForm.last5).toEqual({ matchesConsidered: 0, wins: 0, winRate: null });
    expect(teamWithNoMatches.mapPerformance).toEqual({});
  });

  it("is deterministic across repeated runs given the same input", () => {
    const first = normalizeMatchHistory([matchOne, matchTwo]);
    const second = normalizeMatchHistory([matchOne, matchTwo]);
    expect(second).toEqual(first);
  });

  it("excludes quarantined records from every aggregate", () => {
    // Uses real team/map IDs (unlike the fixtures above) so the valid record
    // actually passes validateMatchHistory's known-team/known-map checks.
    const validRecord: RawMatchRecord = {
      ...structuredClone(matchOne),
      matchId: "quarantine-test:valid",
      teamA: { ...structuredClone(matchOne.teamA), teamId: "sen" },
      teamB: { ...structuredClone(matchOne.teamB), teamId: "loud" },
    };
    const corrupted: RawMatchRecord = structuredClone(validRecord);
    corrupted.matchId = "quarantine-test:corrupted";
    corrupted.teamA.roundsWon = 999; // breaks the total-rounds and economy-consistency validation rules

    const { valid, quarantined } = validateMatchHistory([validRecord, corrupted]);
    expect(quarantined).toHaveLength(1);

    const result = normalizeMatchHistory(valid);
    expect(result.teams.sen!.matchIds).toEqual(["quarantine-test:valid"]);
    expect(result.teams.sen!.matchIds).not.toContain("quarantine-test:corrupted");
  });
});

describe("normalizedMatchHistory", () => {
  it("is precomputed from the validated synthetic dataset and covers every known team", () => {
    expect(Object.keys(normalizedMatchHistory.teams).length).toBeGreaterThan(0);
    for (const aggregate of Object.values(normalizedMatchHistory.teams)) {
      expect(aggregate.matchesPlayed).toBeGreaterThan(0);
    }
  });
});
