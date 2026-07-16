/**
 * Canonical VCT 2026 Stage 1 region and team directory.
 *
 * This directory lists the 4 regions and 32 selectable Stage 1 teams and
 * their visual identity. Visual identity (names, short names, logo paths)
 * is sourced entirely from the TASK-029 asset manifest (`./vctLogos`) so
 * this file never duplicates a logo path by hand.
 *
 * This directory is intentionally separate from the prediction engine's
 * synthetic team dataset (`@repo/prediction-engine`'s `teams`), which still
 * powers Prediction Studio today. TASK-031 is expected to add prediction
 * profiles for this directory — until then, nothing here is wired into the
 * predictor, and the synthetic dataset is left untouched.
 */

import { VCT_REGION_LOGOS, VCT_TEAM_LOGOS, type VctRegionId } from "./vctLogos";

export type { VctRegionId };

export type VctTeamId = (typeof VCT_TEAM_LOGOS)[number]["id"];

export interface VctRegion {
  id: VctRegionId;
  name: string;
  shortName: string;
  logoPath: string;
  teamIds: readonly VctTeamId[];
}

export interface VctTeam {
  id: VctTeamId;
  name: string;
  shortName: string;
  region: VctRegionId;
  logoPath: string;
}

const VCT_REGION_SHORT_NAMES = {
  americas: "AMER",
  emea: "EMEA",
  pacific: "PAC",
  china: "CN",
} as const satisfies Record<VctRegionId, string>;

const VCT_REGION_ORDER: readonly VctRegionId[] = ["americas", "emea", "pacific", "china"];

export const VCT_TEAMS: readonly VctTeam[] = Object.freeze(
  VCT_TEAM_LOGOS.map((team) =>
    Object.freeze({
      id: team.id,
      name: team.name,
      shortName: team.shortName,
      region: team.region,
      logoPath: team.logoPath,
    }),
  ),
);

export const VCT_REGIONS: readonly VctRegion[] = Object.freeze(
  VCT_REGION_ORDER.map((regionId) =>
    Object.freeze({
      id: regionId,
      name: VCT_REGION_LOGOS[regionId].name,
      shortName: VCT_REGION_SHORT_NAMES[regionId],
      logoPath: VCT_REGION_LOGOS[regionId].logoPath,
      teamIds: Object.freeze(
        VCT_TEAMS.filter((team) => team.region === regionId).map((team) => team.id),
      ),
    }),
  ),
);

export function getAllRegions(): readonly VctRegion[] {
  return VCT_REGIONS;
}

export function getRegionById(regionId: VctRegionId): VctRegion | undefined {
  return VCT_REGIONS.find((region) => region.id === regionId);
}

export function getAllTeams(): readonly VctTeam[] {
  return VCT_TEAMS;
}

export function getTeamById(teamId: VctTeamId): VctTeam | undefined {
  return VCT_TEAMS.find((team) => team.id === teamId);
}

export function getTeamsByRegion(regionId: VctRegionId): readonly VctTeam[] {
  return VCT_TEAMS.filter((team) => team.region === regionId);
}

export function isTeamInRegion(teamId: VctTeamId, regionId: VctRegionId): boolean {
  return VCT_TEAMS.some((team) => team.id === teamId && team.region === regionId);
}

/**
 * Returns every team eligible to face `excludeTeamId`, i.e. the full
 * directory minus the already-selected team — the same exclusion rule
 * TeamSelector already applies to the synthetic roster.
 */
export function getOpposingTeams(excludeTeamId: VctTeamId): readonly VctTeam[] {
  return VCT_TEAMS.filter((team) => team.id !== excludeTeamId);
}
