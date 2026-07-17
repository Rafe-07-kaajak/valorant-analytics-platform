import type { VctProfileBaseline } from "@repo/shared";
import type { VctTeamId } from "../data/vctTeams";
import { getVctTeamProfile } from "./vctTeamProfiles";

/**
 * TASK-038. Projects only the What-if Simulator's adjustable fields off a
 * baseline `VctTeamProfile` — never `teamId`, `region`, `archetype`,
 * `overallRating`, `roundDifferential`, or the full (all-map) `mapStrength`
 * record. `mapIds` restricts the returned per-map strengths to whatever set
 * is passed in (the caller is expected to pass only the current scenario's
 * selected maps).
 */
export function getVctProfileBaseline(teamId: VctTeamId, mapIds: readonly string[]): VctProfileBaseline | undefined {
  const profile = getVctTeamProfile(teamId);
  if (!profile) return undefined;

  const mapStrength: Record<string, number> = {};
  for (const mapId of mapIds) {
    if (mapId in profile.mapStrength) mapStrength[mapId] = profile.mapStrength[mapId]!;
  }

  const dnaByKey = new Map(profile.dna.dimensions.map((dimension) => [dimension.key, dimension.value]));

  return {
    attackStrength: profile.attackStrength,
    defenseStrength: profile.defenseStrength,
    economyEfficiency: profile.economyEfficiency,
    clutchPerformance: profile.clutchPerformance,
    consistency: profile.consistency,
    recentFormIndex: profile.recentFormIndex,
    aggression: dnaByKey.get("aggression") ?? 50,
    tempo: dnaByKey.get("tempo") ?? 50,
    mapControl: dnaByKey.get("mapControl") ?? 50,
    utilityEfficiency: dnaByKey.get("utilityEfficiency") ?? 50,
    adaptability: dnaByKey.get("adaptability") ?? 50,
    clutchAbility: dnaByKey.get("clutchAbility") ?? 50,
    mapStrength,
  };
}
