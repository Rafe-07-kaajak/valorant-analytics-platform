import type { VlrMapResult } from "../vlr/schemas/raw";
import { qualityFlag } from "./qualityFlags";
import type { QualityFlag } from "./qualityFlags";

/**
 * Map-score validation — see docs/29-vlr-data-ingestion-foundation.md
 * ("Series and Map Normalization") and TASK-041 requirement 17.
 */
export function validateMapScore(map: VlrMapResult): QualityFlag[] {
  const flags: QualityFlag[] = [];

  if (map.teamAScore === null || map.teamBScore === null) {
    flags.push(qualityFlag("missing_map_score", `Map "${map.mapNameRaw}" (order ${map.order}) was not played or has no recorded score.`));
    return flags;
  }

  if (map.winnerVlrTeamId && map.teamAScore === map.teamBScore) {
    flags.push(qualityFlag("inconsistent_winner", `Map "${map.mapNameRaw}" reports a tied score (${map.teamAScore}-${map.teamBScore}) but a winner is flagged.`));
  }

  return flags;
}

/** Sums completed map wins for each team, given which side of each map the winner ID matches. */
export function countMapWins(maps: readonly VlrMapResult[], teamAVlrTeamId: string, teamBVlrTeamId: string): { teamAWins: number; teamBWins: number } {
  let teamAWins = 0;
  let teamBWins = 0;
  for (const map of maps) {
    if (map.winnerVlrTeamId === teamAVlrTeamId) teamAWins += 1;
    else if (map.winnerVlrTeamId === teamBVlrTeamId) teamBWins += 1;
  }
  return { teamAWins, teamBWins };
}
