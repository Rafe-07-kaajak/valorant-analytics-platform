import type { RawMatchRecord, RawTeamMatchStats } from "../data/matchHistory";
import { syntheticMatchHistory } from "../data/matchHistory";
import { teams } from "../data/teams";
import { validateMatchHistory } from "./validateMatchHistory";

/**
 * Layer 2 (Normalized Database) / Aggregation stage — see
 * docs/06-data-architecture.md ("Layer 2 — Normalized Database"),
 * docs/15-data-architecture.md ("Normalized Data"), and docs/08-ai-pipeline.md
 * (Stage 4 — Aggregation). Converts validated per-match records (TASK-012)
 * into deterministic per-team aggregates that TASK-014's feature engineering
 * consumes, without performing any scoring or presentation logic itself.
 *
 * `null` means insufficient underlying data, distinct from a genuine zero —
 * downstream consumers must treat the two differently rather than defaulting
 * a missing rate to 0.
 */

export type Rate = number | null;

export interface EconomyOutcomeRates {
  eco: Rate;
  force: Rate;
  fullBuy: Rate;
}

export interface FormWindow {
  matchesConsidered: number;
  wins: number;
  winRate: Rate;
}

export interface MapPerformance {
  mapId: string;
  matchesPlayed: number;
  wins: number;
  winRate: Rate;
}

export interface NormalizedTeamAggregate {
  teamId: string;
  matchesPlayed: number;
  /** Sorted match IDs that fed this aggregate, for traceability back to validated input. */
  matchIds: string[];
  overallWinRate: Rate;
  averageRoundDifferential: Rate;
  roundWinRate: Rate;
  economyOutcomeRates: EconomyOutcomeRates;
  entrySuccessRate: Rate;
  clutchConversionRate: Rate;
  recentForm: {
    last5: FormWindow;
    last10: FormWindow;
  };
  mapPerformance: Record<string, MapPerformance>;
}

export interface NormalizedMatchHistory {
  teams: Record<string, NormalizedTeamAggregate>;
}

interface TeamMatchView {
  matchId: string;
  mapId: string;
  playedAt: string;
  won: boolean;
  roundDifferential: number;
  ownRoundsWon: number;
  totalRounds: number;
  stats: RawTeamMatchStats;
}

function teamStats(record: RawMatchRecord, teamId: string): RawTeamMatchStats {
  return record.teamA.teamId === teamId ? record.teamA : record.teamB;
}

function opponentStats(record: RawMatchRecord, teamId: string): RawTeamMatchStats {
  return record.teamA.teamId === teamId ? record.teamB : record.teamA;
}

function collectTeamIds(records: readonly RawMatchRecord[]): Set<string> {
  const ids = new Set(teams.map((team) => team.id));
  for (const record of records) {
    ids.add(record.teamA.teamId);
    ids.add(record.teamB.teamId);
  }
  return ids;
}

/**
 * Most-recent-first view of every match a team played, so recent-form
 * windows and map breakdowns are computed from a single consistent order.
 */
function buildTeamMatchViews(records: readonly RawMatchRecord[], teamId: string): TeamMatchView[] {
  return records
    .filter((record) => record.teamA.teamId === teamId || record.teamB.teamId === teamId)
    .map((record) => {
      const own = teamStats(record, teamId);
      const opponent = opponentStats(record, teamId);
      return {
        matchId: record.matchId,
        mapId: record.mapId,
        playedAt: record.playedAt,
        won: own.roundsWon > opponent.roundsWon,
        roundDifferential: own.roundsWon - opponent.roundsWon,
        ownRoundsWon: own.roundsWon,
        totalRounds: own.roundsWon + opponent.roundsWon,
        stats: own,
      };
    })
    .sort((a, b) => Date.parse(b.playedAt) - Date.parse(a.playedAt) || a.matchId.localeCompare(b.matchId));
}

function safeRate(numerator: number, denominator: number): Rate {
  return denominator > 0 ? numerator / denominator : null;
}

function average(values: readonly number[]): Rate {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function buildFormWindow(matches: readonly TeamMatchView[], size: number): FormWindow {
  const window = matches.slice(0, size);
  const wins = window.filter((match) => match.won).length;
  return { matchesConsidered: window.length, wins, winRate: safeRate(wins, window.length) };
}

function buildMapPerformance(matches: readonly TeamMatchView[]): Record<string, MapPerformance> {
  const byMap = new Map<string, TeamMatchView[]>();
  for (const match of matches) {
    const bucket = byMap.get(match.mapId);
    if (bucket) bucket.push(match);
    else byMap.set(match.mapId, [match]);
  }

  const mapPerformance: Record<string, MapPerformance> = {};
  for (const [mapId, mapMatches] of byMap) {
    const wins = mapMatches.filter((match) => match.won).length;
    mapPerformance[mapId] = {
      mapId,
      matchesPlayed: mapMatches.length,
      wins,
      winRate: safeRate(wins, mapMatches.length),
    };
  }
  return mapPerformance;
}

function buildEconomyOutcomeRates(matches: readonly TeamMatchView[]): EconomyOutcomeRates {
  const totals = {
    eco: { won: 0, played: 0 },
    force: { won: 0, played: 0 },
    fullBuy: { won: 0, played: 0 },
  };

  for (const match of matches) {
    for (const bucket of ["eco", "force", "fullBuy"] as const) {
      totals[bucket].won += match.stats.economy[bucket].roundsWon;
      totals[bucket].played += match.stats.economy[bucket].roundsPlayed;
    }
  }

  return {
    eco: safeRate(totals.eco.won, totals.eco.played),
    force: safeRate(totals.force.won, totals.force.played),
    fullBuy: safeRate(totals.fullBuy.won, totals.fullBuy.played),
  };
}

function buildTeamAggregate(teamId: string, records: readonly RawMatchRecord[]): NormalizedTeamAggregate {
  const matches = buildTeamMatchViews(records, teamId);

  const wins = matches.filter((match) => match.won).length;
  const totalRoundsWon = matches.reduce((sum, match) => sum + match.ownRoundsWon, 0);
  const totalRounds = matches.reduce((sum, match) => sum + match.totalRounds, 0);
  const totalFirstKills = matches.reduce((sum, match) => sum + match.stats.firstKills, 0);
  const totalClutchesFaced = matches.reduce((sum, match) => sum + match.stats.clutches.situationsFaced, 0);
  const totalClutchesWon = matches.reduce((sum, match) => sum + match.stats.clutches.situationsWon, 0);

  return {
    teamId,
    matchesPlayed: matches.length,
    matchIds: matches
      .map((match) => match.matchId)
      .sort((a, b) => a.localeCompare(b)),
    overallWinRate: safeRate(wins, matches.length),
    averageRoundDifferential: average(matches.map((match) => match.roundDifferential)),
    roundWinRate: safeRate(totalRoundsWon, totalRounds),
    economyOutcomeRates: buildEconomyOutcomeRates(matches),
    entrySuccessRate: safeRate(totalFirstKills, totalRounds),
    clutchConversionRate: safeRate(totalClutchesWon, totalClutchesFaced),
    recentForm: {
      last5: buildFormWindow(matches, 5),
      last10: buildFormWindow(matches, 10),
    },
    mapPerformance: buildMapPerformance(matches),
  };
}

/**
 * Normalizes validated match records into per-team aggregates. Callers must
 * pass only validated records (`validateMatchHistory(...).valid`) — this
 * function performs no validation of its own and trusts its input.
 */
export function normalizeMatchHistory(validatedRecords: readonly RawMatchRecord[]): NormalizedMatchHistory {
  const normalizedTeams: Record<string, NormalizedTeamAggregate> = {};
  for (const teamId of collectTeamIds(validatedRecords)) {
    normalizedTeams[teamId] = buildTeamAggregate(teamId, validatedRecords);
  }
  return { teams: normalizedTeams };
}

export const normalizedMatchHistory: NormalizedMatchHistory = normalizeMatchHistory(
  validateMatchHistory(syntheticMatchHistory).valid,
);
