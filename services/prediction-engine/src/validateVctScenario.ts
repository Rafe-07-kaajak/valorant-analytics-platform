import { SERIES_MAP_LIMITS, type PredictionRequest } from "@repo/shared";
import { maps } from "./data/maps";
import type { VctTeamId } from "./data/vctTeams";
import { getVctTeamProfile } from "./lib/vctTeamProfiles";

/**
 * TASK-032 counterpart to `validateScenario.ts`, for the TASK-031 32-team
 * roster. Identical structure and map/series rules — the only difference is
 * team membership is checked against the VCT profile set (`getVctTeamProfile`)
 * instead of the original 8-team `teams` array, since the two rosters use
 * disjoint id spaces. `validateScenario.ts` is left untouched so the
 * original 8-team path keeps behaving exactly as before.
 */
export function validateVctScenario(request: PredictionRequest): string | null {
  if (!request?.clientVersion) {
    return "A client version is required.";
  }
  if (!request?.timestamp) {
    return "A request timestamp is required.";
  }

  const scenario = request?.scenario;

  if (!scenario) {
    return "A scenario is required.";
  }
  if (!scenario.teamAId || !scenario.teamBId) {
    return "Both teams are required.";
  }
  if (scenario.teamAId === scenario.teamBId) {
    return "Team A and Team B must be different.";
  }
  if (!getVctTeamProfile(scenario.teamAId as VctTeamId)) {
    return "Team A is not a known VCT team.";
  }
  if (!getVctTeamProfile(scenario.teamBId as VctTeamId)) {
    return "Team B is not a known VCT team.";
  }
  if (scenario.seriesFormat !== "BO3" && scenario.seriesFormat !== "BO5") {
    return "Series format must be BO3 or BO5.";
  }
  if (scenario.mapIds.length === 0) {
    return "At least one map is required.";
  }
  if (new Set(scenario.mapIds).size !== scenario.mapIds.length) {
    return "Maps must not be duplicated.";
  }
  if (scenario.mapIds.length > SERIES_MAP_LIMITS[scenario.seriesFormat]) {
    return `${scenario.seriesFormat} supports at most ${SERIES_MAP_LIMITS[scenario.seriesFormat]} maps.`;
  }
  if (!scenario.mapIds.every((mapId) => maps.some((map) => map.id === mapId))) {
    return "One or more selected maps are not supported.";
  }

  return null;
}
