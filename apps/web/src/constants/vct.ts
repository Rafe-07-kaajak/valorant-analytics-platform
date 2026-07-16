/**
 * Single public entry point for the VCT region/team directory (TASK-030).
 * Other modules should import from here rather than reaching into
 * `vctDirectory` or `vctLogos` directly.
 */

export {
  VCT_REGIONS,
  VCT_TEAMS,
  getAllRegions,
  getRegionById,
  getAllTeams,
  getTeamById,
  getTeamsByRegion,
  isTeamInRegion,
  getOpposingTeams,
  type VctRegionId,
  type VctTeamId,
  type VctRegion,
  type VctTeam,
} from "./vctDirectory";
