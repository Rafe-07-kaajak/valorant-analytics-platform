import type { NormalizedMatch } from "../normalize/normalizedSchemas";
import type { FeatureRowLabels } from "./types";
import { actuallyPlayedMaps } from "./mapInstances";

export interface LabelBuildResult {
  readonly valid: boolean;
  readonly labels?: FeatureRowLabels;
  readonly reason?: string;
}

/**
 * Label construction — TASK-044 requirement 16. `labelTeamAWin` is derived
 * strictly from `winnerId` against the match's own recorded `teamAId`; a
 * match whose winner isn't one of the two competing teams is rejected here
 * rather than silently labeled, since the curated dataset's own quality
 * gate (`quality/scoreConsistency.ts`) already guarantees this in practice
 * — this is defense-in-depth, not a new source of truth.
 */
export function buildMatchLabels(match: NormalizedMatch): LabelBuildResult {
  if (match.winnerId === null) {
    return { valid: false, reason: `Match ${match.internalId} has no recorded winner.` };
  }
  if (match.winnerId !== match.teamAId && match.winnerId !== match.teamBId) {
    return { valid: false, reason: `Match ${match.internalId}'s winner "${match.winnerId}" is neither team A nor team B.` };
  }

  const playedMaps = actuallyPlayedMaps(match);
  const teamAMapWins = playedMaps.filter((m) => (m.teamAScore as number) > (m.teamBScore as number)).length;
  const teamBMapWins = playedMaps.length - teamAMapWins;

  return {
    valid: true,
    labels: {
      labelTeamAWin: match.winnerId === match.teamAId ? 1 : 0,
      labelWinnerProviderId: match.winnerId,
      labelSeriesScore: `${teamAMapWins}-${teamBMapWins}`,
      labelMapCountPlayed: playedMaps.length,
    },
  };
}
