import { SERIES_MAP_LIMITS, type PredictionRequest } from "@repo/shared";
import { teams } from "./data/teams";
import { maps } from "./data/maps";

export function validateScenario(request: PredictionRequest): string | null {
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
  if (!teams.some((team) => team.id === scenario.teamAId)) {
    return "Team A is not a known team.";
  }
  if (!teams.some((team) => team.id === scenario.teamBId)) {
    return "Team B is not a known team.";
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
