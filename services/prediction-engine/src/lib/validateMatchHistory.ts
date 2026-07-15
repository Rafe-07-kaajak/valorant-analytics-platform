import type { RawMatchRecord } from "../data/matchHistory";
import { maps } from "../data/maps";
import { teams } from "../data/teams";

/**
 * Data Cleaning / Validation stage over the raw match history dataset —
 * see docs/06-data-architecture.md ("Data Validation"), docs/08-ai-pipeline.md
 * ("Stage 2 — Data Cleaning"), and docs/15-data-architecture.md ("Validated
 * Data"). Confirms required information exists and is internally consistent
 * without inventing or correcting anything; it never throws, and never
 * computes features — that is Sprint 03 scope.
 */

const KNOWN_TEAM_IDS = new Set(teams.map((team) => team.id));
const KNOWN_MAP_IDS = new Set(maps.map((map) => map.id));

const MIN_TOTAL_ROUNDS = 13;
const MAX_TOTAL_ROUNDS = 30;

export interface QuarantinedMatchRecord {
  record: RawMatchRecord;
  reasons: string[];
}

export interface MatchHistoryValidationResult {
  valid: RawMatchRecord[];
  quarantined: QuarantinedMatchRecord[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isValidNonFutureTimestamp(value: unknown): boolean {
  if (!isNonEmptyString(value)) return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed) && parsed <= Date.now();
}

interface ParsedEconomyBucket {
  roundsPlayed: number;
  roundsWon: number;
}

function parseEconomyBucket(value: unknown, label: string, reasons: string[]): ParsedEconomyBucket | null {
  if (!isPlainObject(value) || !isNonNegativeInteger(value.roundsPlayed) || !isNonNegativeInteger(value.roundsWon)) {
    reasons.push(`${label} is missing a valid roundsPlayed/roundsWon pair.`);
    return null;
  }
  if (value.roundsWon > value.roundsPlayed) {
    reasons.push(`${label} reports more rounds won than played.`);
    return null;
  }
  return { roundsPlayed: value.roundsPlayed, roundsWon: value.roundsWon };
}

interface ParsedTeamStats {
  teamId: string;
  roundsWon: number;
  firstKills: number;
  economy: { eco: ParsedEconomyBucket; force: ParsedEconomyBucket; fullBuy: ParsedEconomyBucket };
  clutches: { situationsFaced: number; situationsWon: number };
}

function parseTeamStats(value: unknown, label: string, reasons: string[]): ParsedTeamStats | null {
  if (!isPlainObject(value)) {
    reasons.push(`${label} is missing or malformed.`);
    return null;
  }

  const teamIdValid = isNonEmptyString(value.teamId) && KNOWN_TEAM_IDS.has(value.teamId);
  if (!teamIdValid) reasons.push(`${label} references an unknown team ID.`);

  const roundsWonValid = isNonNegativeInteger(value.roundsWon);
  if (!roundsWonValid) reasons.push(`${label} has a missing or invalid roundsWon.`);

  const firstKillsValid = isNonNegativeInteger(value.firstKills);
  if (!firstKillsValid) reasons.push(`${label} has a missing or invalid firstKills.`);

  let economy: ParsedTeamStats["economy"] | null = null;
  if (!isPlainObject(value.economy)) {
    reasons.push(`${label} is missing an economy breakdown.`);
  } else {
    const eco = parseEconomyBucket(value.economy.eco, `${label}.economy.eco`, reasons);
    const force = parseEconomyBucket(value.economy.force, `${label}.economy.force`, reasons);
    const fullBuy = parseEconomyBucket(value.economy.fullBuy, `${label}.economy.fullBuy`, reasons);
    if (eco && force && fullBuy) economy = { eco, force, fullBuy };
  }

  let clutches: ParsedTeamStats["clutches"] | null = null;
  const clutchesValue = value.clutches;
  if (
    !isPlainObject(clutchesValue) ||
    !isNonNegativeInteger(clutchesValue.situationsFaced) ||
    !isNonNegativeInteger(clutchesValue.situationsWon)
  ) {
    reasons.push(`${label} is missing a valid clutch breakdown.`);
  } else if (clutchesValue.situationsWon > clutchesValue.situationsFaced) {
    reasons.push(`${label} reports more clutch situations won than faced.`);
  } else {
    clutches = { situationsFaced: clutchesValue.situationsFaced, situationsWon: clutchesValue.situationsWon };
  }

  if (!teamIdValid || !roundsWonValid || !firstKillsValid || !economy || !clutches) return null;

  return {
    teamId: value.teamId as string,
    roundsWon: value.roundsWon as number,
    firstKills: value.firstKills as number,
    economy,
    clutches,
  };
}

function validateRelationships(teamA: ParsedTeamStats, teamB: ParsedTeamStats, reasons: string[]): void {
  if (teamA.teamId === teamB.teamId) {
    reasons.push("teamA and teamB reference the same team.");
  }

  const totalRounds = teamA.roundsWon + teamB.roundsWon;
  if (totalRounds < MIN_TOTAL_ROUNDS || totalRounds > MAX_TOTAL_ROUNDS) {
    reasons.push(`Total rounds (${totalRounds}) is outside the valid range of ${MIN_TOTAL_ROUNDS}-${MAX_TOTAL_ROUNDS}.`);
  }

  if (teamA.firstKills + teamB.firstKills !== totalRounds) {
    reasons.push("Combined first kills do not match the total rounds played.");
  }

  for (const [label, team] of [
    ["teamA", teamA],
    ["teamB", teamB],
  ] as const) {
    const buckets = [team.economy.eco, team.economy.force, team.economy.fullBuy];
    const economyRoundsPlayed = buckets.reduce((sum, bucket) => sum + bucket.roundsPlayed, 0);
    const economyRoundsWon = buckets.reduce((sum, bucket) => sum + bucket.roundsWon, 0);

    if (economyRoundsPlayed !== totalRounds) {
      reasons.push(`${label} economy rounds played (${economyRoundsPlayed}) do not match total rounds (${totalRounds}).`);
    }
    if (economyRoundsWon !== team.roundsWon) {
      reasons.push(`${label} economy rounds won (${economyRoundsWon}) do not match reported roundsWon (${team.roundsWon}).`);
    }
    if (team.clutches.situationsFaced > totalRounds) {
      reasons.push(`${label} clutch situations faced (${team.clutches.situationsFaced}) exceed total rounds (${totalRounds}).`);
    }
  }
}

/**
 * Validates a single raw match record without throwing. Returns an empty
 * array when the record is valid, otherwise every rule it violated.
 */
export function validateMatchRecord(record: unknown, seenMatchIds: ReadonlySet<string>): string[] {
  if (!isPlainObject(record)) {
    return ["Match record is missing or not an object."];
  }

  const reasons: string[] = [];

  if (!isNonEmptyString(record.matchId)) {
    reasons.push("Match record is missing a matchId.");
  } else if (seenMatchIds.has(record.matchId)) {
    reasons.push(`Duplicate match ID: ${record.matchId}.`);
  }

  if (!isNonEmptyString(record.mapId) || !KNOWN_MAP_IDS.has(record.mapId)) {
    reasons.push("Match record references an unknown map ID.");
  }

  if (!isValidNonFutureTimestamp(record.playedAt)) {
    reasons.push("Match record has a missing, malformed, or future playedAt timestamp.");
  }

  const teamA = parseTeamStats(record.teamA, "teamA", reasons);
  const teamB = parseTeamStats(record.teamB, "teamB", reasons);

  if (teamA && teamB) {
    validateRelationships(teamA, teamB, reasons);
  }

  return reasons;
}

/**
 * Partitions raw match records into valid records and quarantined records
 * with reasons, per docs/06-data-architecture.md: "Invalid records are
 * quarantined. They are never used for analytics."
 */
export function validateMatchHistory(records: readonly RawMatchRecord[]): MatchHistoryValidationResult {
  const valid: RawMatchRecord[] = [];
  const quarantined: QuarantinedMatchRecord[] = [];
  const seenMatchIds = new Set<string>();

  for (const record of records) {
    const reasons = validateMatchRecord(record, seenMatchIds);
    if (reasons.length === 0) {
      valid.push(record);
      seenMatchIds.add(record.matchId);
    } else {
      quarantined.push({ record, reasons });
    }
  }

  return { valid, quarantined };
}
