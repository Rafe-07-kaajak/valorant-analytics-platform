import type { NormalizedMatch, NormalizedRosterSnapshot } from "../normalize/normalizedSchemas";
import { createQualityIssue } from "./qualityIssue";
import type { QualityIssue } from "./qualityIssue";

/**
 * Roster snapshot hardening — TASK-043 requirement 8. Operates only on
 * already-normalized match roster snapshots (`normalize/normalizeMatch.ts`'s
 * `rostersAtMatchTime` → `NormalizedRosterSnapshot[]`, unchanged); this
 * module never infers team membership beyond what a specific match's own
 * snapshot shows, and never overwrites a historical snapshot with a team's
 * current roster.
 */
const EXPECTED_ROSTER_SIZE = 5;
/** A roster below 3 or above 6 named players in one match is not a plausible substitution pattern — flagged as structurally implausible, never forced back to 5. */
const MIN_PLAUSIBLE_ROSTER_SIZE = 3;
const MAX_PLAUSIBLE_ROSTER_SIZE = 6;

export interface RosterCompletenessScore {
  readonly matchInternalId: string;
  /** 0–1: average of each team's (present player count / EXPECTED_ROSTER_SIZE), capped at 1 per team. */
  readonly score: number;
  readonly teamScores: ReadonlyMap<string, number>;
}

export function computeRosterCompletenessScore(match: NormalizedMatch): RosterCompletenessScore {
  const rosters = match.rosterSnapshots ?? [];
  const teamScores = new Map<string, number>();
  for (const roster of rosters) {
    teamScores.set(roster.teamInternalId, Math.min(1, roster.playerInternalIds.length / EXPECTED_ROSTER_SIZE));
  }
  const values = [...teamScores.values()];
  const score = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
  return { matchInternalId: match.internalId, score, teamScores };
}

function detectDuplicatesWithin(playerIds: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of playerIds) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates];
}

/**
 * Audits one match's roster snapshots against the invariants in requirement
 * 8: no duplicate player within a team's own roster, no player appearing on
 * both teams, a plausible (not forced-to-5) roster size, and both teams
 * present when any roster data exists at all.
 */
export function auditMatchRosters(match: NormalizedMatch, detectedAt: string): readonly QualityIssue[] {
  const issues: QualityIssue[] = [];
  const rosters = match.rosterSnapshots ?? [];

  if (rosters.length === 0) {
    return issues; // absence is already surfaced by `incomplete_roster` at normalization time (normalize/normalizeMatch.ts) — nothing new to audit here.
  }

  if (rosters.length === 1) {
    issues.push(
      createQualityIssue({
        code: "incomplete_roster",
        entityType: "roster",
        entityId: match.internalId,
        message: `Match has a roster snapshot for only one team ("${rosters[0]!.teamInternalId}"); the other team's roster is missing entirely.`,
        sourceReference: match.sourceReference.sourceUrl,
        detectedAt,
      }),
    );
  }

  for (const roster of rosters) {
    const duplicates = detectDuplicatesWithin(roster.playerInternalIds);
    for (const duplicatePlayerId of duplicates) {
      issues.push(
        createQualityIssue({
          code: "duplicate_player_in_roster",
          entityType: "roster",
          entityId: match.internalId,
          field: roster.teamInternalId,
          message: `Player "${duplicatePlayerId}" appears more than once in team "${roster.teamInternalId}"'s roster for this match.`,
          sourceReference: match.sourceReference.sourceUrl,
          detectedAt,
        }),
      );
    }

    if (roster.playerInternalIds.length < EXPECTED_ROSTER_SIZE) {
      issues.push(
        createQualityIssue({
          code: "incomplete_roster",
          entityType: "roster",
          entityId: match.internalId,
          field: roster.teamInternalId,
          message: `Team "${roster.teamInternalId}" has ${roster.playerInternalIds.length} of ${EXPECTED_ROSTER_SIZE} expected roster players for this match.`,
          sourceReference: match.sourceReference.sourceUrl,
          detectedAt,
        }),
      );
    }

    if (roster.playerInternalIds.length < MIN_PLAUSIBLE_ROSTER_SIZE || roster.playerInternalIds.length > MAX_PLAUSIBLE_ROSTER_SIZE) {
      issues.push(
        createQualityIssue({
          code: "impossible_roster_size",
          entityType: "roster",
          entityId: match.internalId,
          field: roster.teamInternalId,
          message: `Team "${roster.teamInternalId}" has an implausible roster size of ${roster.playerInternalIds.length} for this match.`,
          sourceReference: match.sourceReference.sourceUrl,
          detectedAt,
        }),
      );
    }
  }

  if (rosters.length === 2) {
    const [teamA, teamB] = rosters as readonly [NormalizedRosterSnapshot, NormalizedRosterSnapshot];
    const teamASet = new Set(teamA.playerInternalIds);
    const sharedPlayers = teamB.playerInternalIds.filter((id) => teamASet.has(id));
    for (const playerId of sharedPlayers) {
      issues.push(
        createQualityIssue({
          code: "player_on_both_teams",
          entityType: "roster",
          entityId: match.internalId,
          message: `Player "${playerId}" appears on both teams' rosters for the same match.`,
          sourceReference: match.sourceReference.sourceUrl,
          detectedAt,
        }),
      );
    }
  }

  return issues;
}

export interface PlayerTeamAppearance {
  readonly playerInternalId: string;
  readonly teamInternalId: string;
  readonly matchInternalId: string;
  readonly asOf: string;
}

/**
 * Builds a player → team appearance timeline strictly from observed match
 * roster snapshots (requirement 8: "do not infer a player's team membership
 * outside observed match evidence"). Deterministically ordered by `asOf`,
 * then match ID.
 */
export function buildPlayerTeamAppearanceTimeline(matches: readonly NormalizedMatch[]): readonly PlayerTeamAppearance[] {
  const appearances: PlayerTeamAppearance[] = [];
  for (const match of matches) {
    for (const roster of match.rosterSnapshots ?? []) {
      for (const playerInternalId of roster.playerInternalIds) {
        appearances.push({ playerInternalId, teamInternalId: roster.teamInternalId, matchInternalId: match.internalId, asOf: roster.asOf });
      }
    }
  }
  return appearances.sort((a, b) => a.asOf.localeCompare(b.asOf) || a.matchInternalId.localeCompare(b.matchInternalId));
}
