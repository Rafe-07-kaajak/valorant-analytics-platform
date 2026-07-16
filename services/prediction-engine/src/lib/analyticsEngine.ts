import type { RawMatchRecord } from "../data/matchHistory";
import { syntheticMatchHistory } from "../data/matchHistory";
import { validateMatchHistory } from "./validateMatchHistory";
import { normalizedMatchHistory } from "./normalizeMatchHistory";
import type { FormWindow, MapPerformance, NormalizedMatchHistory, Rate } from "./normalizeMatchHistory";

/**
 * Analytics Engine — see docs/03-system-architecture.md ("Analytics Engine")
 * and docs/06-data-architecture.md ("Layer 3 — Analytics Warehouse"), which
 * name Map Win Rate, Recent Form, Head-to-head, and Round Differential as
 * this engine's outputs and require them to be "generated automatically" so
 * "no frontend request should trigger heavy analytical computation."
 *
 * Map Win Rate, Recent Form, and Round Differential are direct reads of
 * TASK-013's normalized per-team aggregate — this module never recomputes
 * them, per docs/06's "Never duplicate statistics across layers." Head-to-
 * head is a two-team comparison that a per-team aggregate cannot express, so
 * it is precomputed once at module load from the same validated match
 * records TASK-013 normalizes, then served from an in-memory index.
 */

export interface HeadToHeadRecord {
  teamAId: string;
  teamBId: string;
  matchesPlayed: number;
  teamAWins: number;
  teamBWins: number;
  /** Team A's win rate in this pairing, from Team A's perspective. */
  teamAWinRate: Rate;
  /** Team A's average round differential across these matches. */
  averageRoundDifferential: Rate;
}

function pairKey(teamAId: string, teamBId: string): string {
  return [teamAId, teamBId].sort().join("::");
}

function invertHeadToHead(record: HeadToHeadRecord): HeadToHeadRecord {
  return {
    teamAId: record.teamBId,
    teamBId: record.teamAId,
    matchesPlayed: record.matchesPlayed,
    teamAWins: record.teamBWins,
    teamBWins: record.teamAWins,
    teamAWinRate: record.teamAWinRate === null ? null : 1 - record.teamAWinRate,
    averageRoundDifferential:
      record.averageRoundDifferential === null ? null : -record.averageRoundDifferential,
  };
}

function buildHeadToHeadRecord(
  teamAId: string,
  teamBId: string,
  matches: readonly RawMatchRecord[],
): HeadToHeadRecord {
  let teamAWins = 0;
  let roundDifferentialSum = 0;

  for (const match of matches) {
    const teamAStats = match.teamA.teamId === teamAId ? match.teamA : match.teamB;
    const teamBStats = match.teamA.teamId === teamAId ? match.teamB : match.teamA;
    if (teamAStats.roundsWon > teamBStats.roundsWon) teamAWins += 1;
    roundDifferentialSum += teamAStats.roundsWon - teamBStats.roundsWon;
  }

  return {
    teamAId,
    teamBId,
    matchesPlayed: matches.length,
    teamAWins,
    teamBWins: matches.length - teamAWins,
    teamAWinRate: matches.length > 0 ? teamAWins / matches.length : null,
    averageRoundDifferential: matches.length > 0 ? roundDifferentialSum / matches.length : null,
  };
}

/**
 * Precomputes every pairwise Head-to-head record once from validated match
 * records, keyed by an order-independent pair key.
 */
export function buildHeadToHeadIndex(
  validatedRecords: readonly RawMatchRecord[],
): Map<string, HeadToHeadRecord> {
  const matchesByPair = new Map<string, RawMatchRecord[]>();
  for (const record of validatedRecords) {
    const key = pairKey(record.teamA.teamId, record.teamB.teamId);
    const bucket = matchesByPair.get(key);
    if (bucket) bucket.push(record);
    else matchesByPair.set(key, [record]);
  }

  const index = new Map<string, HeadToHeadRecord>();
  for (const [key, matches] of matchesByPair) {
    const [teamAId, teamBId] = key.split("::") as [string, string];
    index.set(key, buildHeadToHeadRecord(teamAId, teamBId, matches));
  }
  return index;
}

const defaultHeadToHeadIndex = buildHeadToHeadIndex(validateMatchHistory(syntheticMatchHistory).valid);

/**
 * Head-to-head record between two teams, described from `teamAId`'s
 * perspective. Symmetric: `getHeadToHead(a, b)` and `getHeadToHead(b, a)`
 * describe the same underlying matches, correctly inverted. Returns `null`
 * when the two teams have no recorded history against each other, per
 * docs/10-prediction-engine.md's "Honesty is preferred over certainty."
 */
export function getHeadToHead(
  teamAId: string,
  teamBId: string,
  index: ReadonlyMap<string, HeadToHeadRecord> = defaultHeadToHeadIndex,
): HeadToHeadRecord | null {
  const record = index.get(pairKey(teamAId, teamBId));
  if (!record) return null;
  return record.teamAId === teamAId ? record : invertHeadToHead(record);
}

/** Per-team map win rate — a direct read of TASK-013's normalized aggregate. */
export function getMapWinRates(
  teamId: string,
  history: NormalizedMatchHistory = normalizedMatchHistory,
): Record<string, MapPerformance> {
  return history.teams[teamId]?.mapPerformance ?? {};
}

/** Per-team recent form (last 5 / last 10) — a direct read of TASK-013's normalized aggregate. */
export function getRecentForm(
  teamId: string,
  history: NormalizedMatchHistory = normalizedMatchHistory,
): { last5: FormWindow; last10: FormWindow } | null {
  const aggregate = history.teams[teamId];
  return aggregate ? aggregate.recentForm : null;
}

/** Per-team average round differential — a direct read of TASK-013's normalized aggregate. */
export function getRoundDifferential(
  teamId: string,
  history: NormalizedMatchHistory = normalizedMatchHistory,
): Rate {
  return history.teams[teamId]?.averageRoundDifferential ?? null;
}
