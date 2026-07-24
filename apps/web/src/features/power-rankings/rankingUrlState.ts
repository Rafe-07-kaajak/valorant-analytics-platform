import { isValidRegionId, isValidTeamId, MAX_PARAM_LENGTH } from "../../lib/urlState";
import type { VctRegionId, VctTeamId } from "../../constants/vct";
import type { RankingMode } from "./rankingTypes";

/**
 * Power Rankings' own small URL-state shape. Deliberately not an extension of
 * `CanonicalUrlState` (the shared `regionA/teamA/regionB/teamB/maps/format`
 * contract): that shape models a two-side "Team A vs Team B" comparison all
 * three existing routes share exactly, and Power Rankings' state (a ranking
 * mode, an optional region, an optional dossier team) doesn't fit it — bolting
 * unrelated fields onto the shared contract would cost every existing route
 * unused fields for no reuse benefit. The *pattern* below (parse-and-repair,
 * never throw; omit-default serialize; a `router.replace`-based two-way sync
 * hook) mirrors `lib/urlState`/`useCanonicalUrlState` on purpose; only the
 * type itself is new.
 */
export interface PowerRankingsUrlState {
  mode: RankingMode;
  region: VctRegionId | null;
  team: VctTeamId | null;
}

export const EMPTY_POWER_RANKINGS_URL_STATE: PowerRankingsUrlState = Object.freeze({
  mode: "global",
  region: null,
  team: null,
}) as PowerRankingsUrlState;

function readParam(searchParams: URLSearchParams, key: string): string | null {
  const value = searchParams.get(key);
  if (!value || value.length > MAX_PARAM_LENGTH) return null;
  return value;
}

/**
 * Parses and repairs `URLSearchParams` into `PowerRankingsUrlState`. Never
 * throws:
 * - an invalid `region` becomes `null`
 * - `mode=regional` with no valid region collapses to `"global"` rather than
 *   guessing a region
 * - an invalid `team` becomes `null` (reuses the same `isValidTeamId`
 *   validator every other route already uses)
 */
export function parsePowerRankingsUrlState(searchParams: URLSearchParams): PowerRankingsUrlState {
  const rawMode = readParam(searchParams, "mode");
  const rawRegion = readParam(searchParams, "region");
  const rawTeam = readParam(searchParams, "team");

  const region = isValidRegionId(rawRegion) ? rawRegion : null;
  const mode: RankingMode = rawMode === "regional" && region ? "regional" : "global";
  const team = isValidTeamId(rawTeam) ? rawTeam : null;

  return { mode, region, team };
}

/** Omits every field at its default, so plain `/power-rankings` never gets a query string. */
export function serializePowerRankingsUrlState(state: PowerRankingsUrlState): string {
  const params = new URLSearchParams();
  if (state.mode === "regional") params.set("mode", state.mode);
  if (state.mode === "regional" && state.region) params.set("region", state.region);
  if (state.team) params.set("team", state.team);
  return params.toString();
}

/** Structural equality, used by `usePowerRankingsUrlState` to avoid redundant state updates. */
export function powerRankingsUrlStatesEqual(a: PowerRankingsUrlState, b: PowerRankingsUrlState): boolean {
  return a.mode === b.mode && a.region === b.region && a.team === b.team;
}

export function withMode(state: PowerRankingsUrlState, mode: RankingMode, fallbackRegion: VctRegionId): PowerRankingsUrlState {
  if (mode === "global") return { ...state, mode };
  return { ...state, mode, region: state.region ?? fallbackRegion };
}

export function withRegion(state: PowerRankingsUrlState, region: VctRegionId): PowerRankingsUrlState {
  return { ...state, region };
}

export function withTeam(state: PowerRankingsUrlState, team: VctTeamId | null): PowerRankingsUrlState {
  return { ...state, team };
}
