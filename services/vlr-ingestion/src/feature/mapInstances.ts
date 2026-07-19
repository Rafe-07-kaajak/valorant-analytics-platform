import type { NormalizedMapResult, NormalizedMatch } from "../normalize/normalizedSchemas";
import { isUnplayedMapPlaceholder } from "../quality/mapHardening";
import type { PlayedMapInstance } from "./teamState";

/**
 * A map slot counts as "actually played" only when it isn't an unplayed
 * placeholder (`"N/A"`, `"TBD"`, an unplayed decider) and both scores were
 * recorded — TASK-044 requirement 8/16. This is the single shared
 * definition used by both label construction (`labels.ts`) and post-match
 * state updates (`stateEngine.ts`), so the two can never disagree about
 * which maps counted.
 */
export function isMapActuallyPlayed(map: NormalizedMapResult): boolean {
  return !isUnplayedMapPlaceholder(map.map.raw) && map.teamAScore !== null && map.teamBScore !== null;
}

export function actuallyPlayedMaps(match: NormalizedMatch): readonly NormalizedMapResult[] {
  return match.maps.filter(isMapActuallyPlayed);
}

/** Builds the played-map instances for one team's perspective, for post-match state updates only — never read as a pre-match input for the current match. */
export function extractPlayedMapInstancesForTeam(match: NormalizedMatch, teamId: "teamA" | "teamB"): readonly PlayedMapInstance[] {
  return actuallyPlayedMaps(match).map((map) => {
    const isA = teamId === "teamA";
    return {
      mapName: map.map.name,
      recognized: map.map.recognized,
      teamScore: (isA ? map.teamAScore : map.teamBScore) as number,
      opponentScore: (isA ? map.teamBScore : map.teamAScore) as number,
      teamAttackScore: isA ? map.teamAAttackScore : map.teamBAttackScore,
      teamDefenseScore: isA ? map.teamADefenseScore : map.teamBDefenseScore,
      opponentAttackScore: isA ? map.teamBAttackScore : map.teamAAttackScore,
      opponentDefenseScore: isA ? map.teamBDefenseScore : map.teamADefenseScore,
    };
  });
}
