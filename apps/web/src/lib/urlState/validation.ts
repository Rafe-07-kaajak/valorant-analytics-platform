import type { SeriesFormat } from "@repo/shared";
import { getTeamById, VCT_REGIONS, type VctRegionId, type VctTeamId } from "../../constants/vct";

/** Defensive cap on any single raw query-parameter value before it's ever looked up — no legitimate id is anywhere close to this length. */
export const MAX_PARAM_LENGTH = 100;

const VALID_REGION_IDS = new Set<string>(VCT_REGIONS.map((region) => region.id));
const VALID_SERIES_FORMATS = new Set<string>(["BO3", "BO5"]);

export function isValidTeamId(value: string | null): value is VctTeamId {
  if (!value || value.length > MAX_PARAM_LENGTH) return false;
  return getTeamById(value as VctTeamId) !== undefined;
}

export function isValidRegionId(value: string | null): value is VctRegionId {
  if (!value || value.length > MAX_PARAM_LENGTH) return false;
  return VALID_REGION_IDS.has(value);
}

export function isValidSeriesFormat(value: string | null): value is SeriesFormat {
  if (!value || value.length > MAX_PARAM_LENGTH) return false;
  return VALID_SERIES_FORMATS.has(value);
}

/** A valid team id is always the source of truth for its region — this is the one deterministic repair rule used everywhere a team and region might disagree. */
export function regionForTeam(teamId: VctTeamId): VctRegionId {
  return getTeamById(teamId)!.region;
}
