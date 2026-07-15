import { maps } from "./maps";
import { teams } from "./teams";
import { seededRatio } from "../lib/seededRatio";

/**
 * Synthetic Layer 1 (Raw Storage) match data — see docs/06-data-architecture.md
 * ("Layer 1 — Raw Storage") and docs/08-ai-pipeline.md ("Stage 1 — Raw Data").
 *
 * No live match data source is connected yet (see README), so every record
 * here is generated, not collected. It stands in for what a real match
 * provider response would contain until a real Collector exists. Nothing in
 * this module performs feature engineering — it is intentionally left for
 * Sprint 03's Normalizer/Feature Engine stages to consume.
 */

export interface EconomyBucketOutcome {
  roundsPlayed: number;
  roundsWon: number;
}

export interface TeamEconomyOutcome {
  eco: EconomyBucketOutcome;
  force: EconomyBucketOutcome;
  fullBuy: EconomyBucketOutcome;
}

export interface ClutchOutcome {
  situationsFaced: number;
  situationsWon: number;
}

export interface RawTeamMatchStats {
  teamId: string;
  roundsWon: number;
  firstKills: number;
  economy: TeamEconomyOutcome;
  clutches: ClutchOutcome;
}

export interface RawMatchRecord {
  matchId: string;
  mapId: string;
  playedAt: string;
  teamA: RawTeamMatchStats;
  teamB: RawTeamMatchStats;
}

const MIN_ROUNDS_TO_WIN = 13;
const MAX_LOSER_ROUNDS = 11;
const ECO_BUY_THRESHOLD = 0.2;
const FORCE_BUY_THRESHOLD = 0.45;
const CLUTCH_ROUND_PROBABILITY = 0.12;
const DATASET_ANCHOR_MS = Date.parse("2025-06-01T00:00:00.000Z");
const HISTORY_SPAN_DAYS = 400;
const DAY_MS = 24 * 60 * 60 * 1000;

type BuyType = "eco" | "force" | "fullBuy";

function pickBuyType(ratio: number): BuyType {
  if (ratio < ECO_BUY_THRESHOLD) return "eco";
  if (ratio < FORCE_BUY_THRESHOLD) return "force";
  return "fullBuy";
}

function emptyTeamStats(teamId: string): RawTeamMatchStats {
  return {
    teamId,
    roundsWon: 0,
    firstKills: 0,
    economy: {
      eco: { roundsPlayed: 0, roundsWon: 0 },
      force: { roundsPlayed: 0, roundsWon: 0 },
      fullBuy: { roundsPlayed: 0, roundsWon: 0 },
    },
    clutches: { situationsFaced: 0, situationsWon: 0 },
  };
}

function applyEconomyRound(stats: RawTeamMatchStats, buyType: BuyType, wonRound: boolean): void {
  const bucket = stats.economy[buyType];
  bucket.roundsPlayed += 1;
  if (wonRound) bucket.roundsWon += 1;
}

/**
 * Rounds are simulated one at a time (rather than deriving summary counts
 * directly) so every aggregate — round score, economy buckets, clutch
 * counts — stays internally consistent by construction instead of needing
 * separate reconciliation logic.
 */
function simulateMatch(matchId: string, teamAId: string, teamBId: string): [RawTeamMatchStats, RawTeamMatchStats] {
  const totalRounds = MIN_ROUNDS_TO_WIN + Math.floor(seededRatio(`${matchId}:roundCount`) * (MAX_LOSER_ROUNDS + 1));
  const teamAWinBias = 0.3 + seededRatio(`${matchId}:bias`) * 0.4;

  const teamA = emptyTeamStats(teamAId);
  const teamB = emptyTeamStats(teamBId);

  for (let round = 0; round < totalRounds; round++) {
    const seed = `${matchId}:round:${round}`;
    const teamAWinsRound = seededRatio(`${seed}:winner`) < teamAWinBias;

    if (teamAWinsRound) teamA.roundsWon += 1;
    else teamB.roundsWon += 1;

    const firstKillBias = teamAWinsRound ? 0.65 : 0.35;
    if (seededRatio(`${seed}:firstKill`) < firstKillBias) teamA.firstKills += 1;
    else teamB.firstKills += 1;

    applyEconomyRound(teamA, pickBuyType(seededRatio(`${seed}:economyA`)), teamAWinsRound);
    applyEconomyRound(teamB, pickBuyType(seededRatio(`${seed}:economyB`)), !teamAWinsRound);

    if (seededRatio(`${seed}:clutch`) < CLUTCH_ROUND_PROBABILITY) {
      const teamAFacesClutch = seededRatio(`${seed}:clutchSide`) < 0.5;
      const facingStats = teamAFacesClutch ? teamA : teamB;
      facingStats.clutches.situationsFaced += 1;
      if (teamAFacesClutch === teamAWinsRound) facingStats.clutches.situationsWon += 1;
    }
  }

  return [teamA, teamB];
}

function derivePlayedAt(matchId: string): string {
  const offsetDays = Math.floor(seededRatio(`${matchId}:playedAt`) * HISTORY_SPAN_DAYS);
  return new Date(DATASET_ANCHOR_MS - offsetDays * DAY_MS).toISOString();
}

function buildMatchId(mapId: string, teamAId: string, teamBId: string): string {
  return `synthetic:${mapId}:${teamAId}:${teamBId}`;
}

/**
 * Standard "circle method" round-robin: team 0 stays fixed while the rest
 * rotate one position per round, producing a different, deterministic set
 * of opponent pairings for each round index. Requires an even team count.
 */
function roundRobinPairs(teamIds: string[], round: number): [string, string][] {
  const [fixedTeamId, ...rotatingTeamIds] = teamIds;
  const arranged = [
    fixedTeamId!,
    ...rotatingTeamIds.map((_, index) => rotatingTeamIds[(index + round) % rotatingTeamIds.length]!),
  ];

  const pairs: [string, string][] = [];
  for (let i = 0; i < arranged.length / 2; i++) {
    pairs.push([arranged[i]!, arranged[arranged.length - 1 - i]!]);
  }
  return pairs;
}

/**
 * Generates the synthetic raw match history from scratch. Exposed alongside
 * the precomputed `syntheticMatchHistory` constant so determinism can be
 * verified directly: calling it twice must produce identical output.
 */
export function generateSyntheticMatchHistory(): RawMatchRecord[] {
  const teamIds = teams.map((team) => team.id);
  const roundRobinCycleLength = teamIds.length - 1;

  return maps.flatMap((map, mapIndex) => {
    const pairs = roundRobinPairs(teamIds, mapIndex % roundRobinCycleLength);

    return pairs.map(([teamAId, teamBId]) => {
      const matchId = buildMatchId(map.id, teamAId!, teamBId!);
      const [teamA, teamB] = simulateMatch(matchId, teamAId!, teamBId!);

      return {
        matchId,
        mapId: map.id,
        playedAt: derivePlayedAt(matchId),
        teamA,
        teamB,
      } satisfies RawMatchRecord;
    });
  });
}

export const syntheticMatchHistory: RawMatchRecord[] = generateSyntheticMatchHistory();
