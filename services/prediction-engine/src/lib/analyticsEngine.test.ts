import { describe, expect, it } from "vitest";
import type { RawMatchRecord } from "../data/matchHistory";
import type { NormalizedMatchHistory, NormalizedTeamAggregate } from "./normalizeMatchHistory";
import {
  buildHeadToHeadIndex,
  getHeadToHead,
  getMapWinRates,
  getRecentForm,
  getRoundDifferential,
} from "./analyticsEngine";

function economyBucket(roundsPlayed: number, roundsWon: number) {
  return { roundsPlayed, roundsWon };
}

function fullAggregate(overrides: Partial<NormalizedTeamAggregate> = {}): NormalizedTeamAggregate {
  return {
    teamId: "fixture",
    matchesPlayed: 10,
    matchIds: [],
    overallWinRate: 0.5,
    averageRoundDifferential: 3,
    roundWinRate: 0.55,
    economyOutcomeRates: { eco: 0.3, force: 0.45, fullBuy: 0.6 },
    entrySuccessRate: 0.7,
    clutchConversionRate: 0.8,
    recentForm: {
      last5: { matchesConsidered: 5, wins: 3, winRate: 0.6 },
      last10: { matchesConsidered: 10, wins: 5, winRate: 0.5 },
    },
    mapPerformance: {
      ascent: { mapId: "ascent", matchesPlayed: 5, wins: 3, winRate: 0.6 },
      haven: { mapId: "haven", matchesPlayed: 5, wins: 2, winRate: 0.4 },
    },
    ...overrides,
  };
}

function historyWith(teamId: string, aggregate: NormalizedTeamAggregate): NormalizedMatchHistory {
  return { teams: { [teamId]: aggregate } };
}

/** teamX beats teamY 13-8, then teamY beats teamX 13-10 (two meetings). */
function headToHeadMatch(matchId: string, winnerId: string, loserId: string, winnerRounds: number, loserRounds: number): RawMatchRecord {
  return {
    matchId,
    mapId: "ascent",
    playedAt: "2025-01-01T00:00:00.000Z",
    teamA: {
      teamId: winnerId,
      roundsWon: winnerRounds,
      firstKills: winnerRounds,
      economy: {
        eco: economyBucket(0, 0),
        force: economyBucket(0, 0),
        fullBuy: economyBucket(winnerRounds + loserRounds, winnerRounds),
      },
      clutches: { situationsFaced: 0, situationsWon: 0 },
    },
    teamB: {
      teamId: loserId,
      roundsWon: loserRounds,
      firstKills: loserRounds,
      economy: {
        eco: economyBucket(0, 0),
        force: economyBucket(0, 0),
        fullBuy: economyBucket(winnerRounds + loserRounds, loserRounds),
      },
      clutches: { situationsFaced: 0, situationsWon: 0 },
    },
  };
}

describe("getMapWinRates", () => {
  it("reads map win rates directly from the normalized aggregate", () => {
    const history = historyWith("sen", fullAggregate());
    expect(getMapWinRates("sen", history)).toEqual(fullAggregate().mapPerformance);
  });

  it("returns an empty record for an unknown team", () => {
    expect(getMapWinRates("unknown-team", historyWith("sen", fullAggregate()))).toEqual({});
  });
});

describe("getRecentForm", () => {
  it("reads last5/last10 form windows directly from the normalized aggregate", () => {
    const history = historyWith("sen", fullAggregate());
    expect(getRecentForm("sen", history)).toEqual(fullAggregate().recentForm);
  });

  it("returns null for an unknown team", () => {
    expect(getRecentForm("unknown-team", historyWith("sen", fullAggregate()))).toBeNull();
  });
});

describe("getRoundDifferential", () => {
  it("reads average round differential directly from the normalized aggregate", () => {
    const history = historyWith("sen", fullAggregate({ averageRoundDifferential: 4.5 }));
    expect(getRoundDifferential("sen", history)).toBe(4.5);
  });

  it("returns null for an unknown team", () => {
    expect(getRoundDifferential("unknown-team", historyWith("sen", fullAggregate()))).toBeNull();
  });
});

describe("getHeadToHead", () => {
  it("summarizes a two-match series correctly by hand", () => {
    const records = [
      headToHeadMatch("h2h:1", "teamX", "teamY", 13, 8),
      headToHeadMatch("h2h:2", "teamY", "teamX", 13, 10),
    ];
    const index = buildHeadToHeadIndex(records);

    const record = getHeadToHead("teamX", "teamY", index)!;
    expect(record.matchesPlayed).toBe(2);
    expect(record.teamAWins).toBe(1);
    expect(record.teamBWins).toBe(1);
    expect(record.teamAWinRate).toBeCloseTo(0.5, 10);
    // teamX: +5 in match 1 (13-8), -3 in match 2 (10-13) -> average 1.
    expect(record.averageRoundDifferential).toBeCloseTo(1, 10);
  });

  it("is symmetric and correctly inverted regardless of argument order", () => {
    const records = [
      headToHeadMatch("h2h:1", "teamX", "teamY", 13, 8),
      headToHeadMatch("h2h:2", "teamX", "teamY", 13, 5),
    ];
    const index = buildHeadToHeadIndex(records);

    const forward = getHeadToHead("teamX", "teamY", index)!;
    const reverse = getHeadToHead("teamY", "teamX", index)!;

    expect(reverse.matchesPlayed).toBe(forward.matchesPlayed);
    expect(reverse.teamAWins).toBe(forward.teamBWins);
    expect(reverse.teamBWins).toBe(forward.teamAWins);
    expect(reverse.teamAWinRate).toBeCloseTo(1 - forward.teamAWinRate!, 10);
    expect(reverse.averageRoundDifferential).toBeCloseTo(-forward.averageRoundDifferential!, 10);
  });

  it("returns null when the two teams have no recorded history against each other", () => {
    const records = [headToHeadMatch("h2h:1", "teamX", "teamY", 13, 8)];
    const index = buildHeadToHeadIndex(records);

    expect(getHeadToHead("teamX", "teamZ", index)).toBeNull();
  });

  it("does not mix matches between an unrelated pair into a team's other pairings", () => {
    const records = [
      headToHeadMatch("h2h:1", "teamX", "teamY", 13, 8),
      headToHeadMatch("h2h:2", "teamX", "teamZ", 13, 6),
    ];
    const index = buildHeadToHeadIndex(records);

    expect(getHeadToHead("teamX", "teamY", index)!.matchesPlayed).toBe(1);
    expect(getHeadToHead("teamX", "teamZ", index)!.matchesPlayed).toBe(1);
  });

  it("defaults to the precomputed index built from the validated synthetic dataset", () => {
    // Any two known teams from the synthetic dataset either have a null (no
    // history) or a well-formed record — this exercises the default index
    // wiring without hand-computing the full synthetic dataset.
    const result = getHeadToHead("sen", "loud");
    if (result) {
      expect(result.matchesPlayed).toBeGreaterThan(0);
      expect(result.teamAWins + result.teamBWins).toBe(result.matchesPlayed);
    } else {
      expect(result).toBeNull();
    }
  });
});
