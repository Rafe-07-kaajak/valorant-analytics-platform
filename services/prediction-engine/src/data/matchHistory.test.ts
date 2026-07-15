import { describe, expect, it } from "vitest";
import { generateSyntheticMatchHistory, syntheticMatchHistory } from "./matchHistory";
import { teams } from "./teams";
import { maps } from "./maps";

const teamIds = new Set(teams.map((team) => team.id));
const mapIds = new Set(maps.map((map) => map.id));

describe("generateSyntheticMatchHistory", () => {
  it("is deterministic across separate generations", () => {
    expect(generateSyntheticMatchHistory()).toEqual(generateSyntheticMatchHistory());
  });

  it("produces a non-empty dataset", () => {
    expect(syntheticMatchHistory.length).toBeGreaterThan(0);
  });

  it("has no duplicate match IDs", () => {
    const matchIds = syntheticMatchHistory.map((match) => match.matchId);
    expect(new Set(matchIds).size).toBe(matchIds.length);
  });

  it("covers every existing team", () => {
    const teamsSeen = new Set<string>();
    for (const match of syntheticMatchHistory) {
      teamsSeen.add(match.teamA.teamId);
      teamsSeen.add(match.teamB.teamId);
    }
    expect(teamsSeen).toEqual(teamIds);
  });

  it("covers every existing map", () => {
    const mapsSeen = new Set(syntheticMatchHistory.map((match) => match.mapId));
    expect(mapsSeen).toEqual(mapIds);
  });

  it("only references known teams and maps", () => {
    for (const match of syntheticMatchHistory) {
      expect(mapIds.has(match.mapId)).toBe(true);
      expect(teamIds.has(match.teamA.teamId)).toBe(true);
      expect(teamIds.has(match.teamB.teamId)).toBe(true);
      expect(match.teamA.teamId).not.toBe(match.teamB.teamId);
    }
  });

  it("has a valid ISO timestamp for every match", () => {
    for (const match of syntheticMatchHistory) {
      expect(Number.isNaN(Date.parse(match.playedAt))).toBe(false);
      expect(match.playedAt).toBe(new Date(match.playedAt).toISOString());
    }
  });

  it("keeps round, economy, and clutch counts internally consistent", () => {
    for (const match of syntheticMatchHistory) {
      const totalRounds = match.teamA.roundsWon + match.teamB.roundsWon;
      expect(totalRounds).toBeGreaterThanOrEqual(13);
      expect(match.teamA.firstKills + match.teamB.firstKills).toBe(totalRounds);

      for (const team of [match.teamA, match.teamB]) {
        const buckets = [team.economy.eco, team.economy.force, team.economy.fullBuy];
        const roundsPlayed = buckets.reduce((sum, bucket) => sum + bucket.roundsPlayed, 0);
        const roundsWonFromBuckets = buckets.reduce((sum, bucket) => sum + bucket.roundsWon, 0);

        expect(roundsPlayed).toBe(totalRounds);
        expect(roundsWonFromBuckets).toBe(team.roundsWon);
        for (const bucket of buckets) {
          expect(bucket.roundsWon).toBeLessThanOrEqual(bucket.roundsPlayed);
        }

        expect(team.clutches.situationsWon).toBeLessThanOrEqual(team.clutches.situationsFaced);
        expect(team.clutches.situationsFaced).toBeLessThanOrEqual(totalRounds);
      }
    }
  });
});
