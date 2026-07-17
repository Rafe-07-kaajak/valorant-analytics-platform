import { SERIES_MAP_LIMITS } from "@repo/shared";
import { parseMapIdsParam } from "./mapIds";
import type { CanonicalUrlState } from "./types";
import { isValidRegionId, isValidSeriesFormat, isValidTeamId, MAX_PARAM_LENGTH, regionForTeam } from "./validation";

export interface ParseUrlStateOptions {
  /** The full set of ids `maps=` may reference — callers derive this from the same `GameMap[]` list already passed down from the server page, never imported directly here (this module must stay free of `@repo/prediction-engine`). */
  validMapIds: ReadonlySet<string>;
}

function readParam(searchParams: URLSearchParams, key: string): string | null {
  const value = searchParams.get(key);
  if (!value || value.length > MAX_PARAM_LENGTH) return null;
  return value;
}

/**
 * Parses and repairs `URLSearchParams` into the canonical state shape. This
 * is the single source of truth for every validation/repair rule in the
 * TASK-039 contract:
 *
 * - an unknown team id is treated as absent
 * - a valid team id always wins over a conflicting/missing region — its
 *   region is derived from the team, never the other way around
 * - the same team on both sides keeps Team A and clears Team B
 * - `maps=` is deduplicated, validated, and canonically ordered
 * - an unsupported `format=` is dropped (becomes `null`), never crashes
 * - when a valid format is present, `maps` is capped to that format's limit
 *
 * Runs identically on the server (via `toUrlSearchParams`) and in the
 * client-side sync hook, so there is exactly one implementation of these
 * rules.
 */
export function parseUrlState(searchParams: URLSearchParams, options: ParseUrlStateOptions): CanonicalUrlState {
  const rawTeamA = readParam(searchParams, "teamA");
  const rawTeamB = readParam(searchParams, "teamB");
  const rawRegionA = readParam(searchParams, "regionA");
  const rawRegionB = readParam(searchParams, "regionB");
  const rawMaps = readParam(searchParams, "maps");
  const rawFormat = readParam(searchParams, "format");

  const teamA = isValidTeamId(rawTeamA) ? rawTeamA : null;
  let teamB = isValidTeamId(rawTeamB) ? rawTeamB : null;

  if (teamA && teamB && teamA === teamB) {
    teamB = null;
  }

  const regionA = teamA ? regionForTeam(teamA) : isValidRegionId(rawRegionA) ? rawRegionA : null;
  const regionB = teamB ? regionForTeam(teamB) : isValidRegionId(rawRegionB) ? rawRegionB : null;

  const format = isValidSeriesFormat(rawFormat) ? rawFormat : null;
  const parsedMaps = parseMapIdsParam(rawMaps, options.validMapIds);
  const maps = format ? parsedMaps.slice(0, SERIES_MAP_LIMITS[format]) : parsedMaps;

  return { regionA, teamA, regionB, teamB, maps, format };
}
