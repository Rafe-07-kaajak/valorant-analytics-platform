import { SERIES_MAP_LIMITS, type SeriesFormat } from "@repo/shared";
import type { VctRegionId, VctTeamId } from "../../constants/vct";
import { sortMapIdsCanonically } from "./mapIds";
import type { CanonicalUrlState, ScenarioMode } from "./types";
import { regionForTeam } from "./validation";

/**
 * Pure state transitions for interactive selection changes — centralizes the
 * "changing region resets that side's team" and "a team's region is always
 * derived from the team" rules in one place so every feature's client
 * component applies them identically instead of re-implementing them.
 *
 * Same-team prevention isn't handled here: the existing `VctTeamSideSelector`
 * already disables the opposing side's team card, so an interactive
 * `withTeamA`/`withTeamB` call can never legitimately request the opposing
 * team. Same-team repair for URL-originated state lives in `parse.ts`.
 */

export function withRegionA(state: CanonicalUrlState, regionId: VctRegionId): CanonicalUrlState {
  return { ...state, regionA: regionId, teamA: null };
}

export function withTeamA(state: CanonicalUrlState, teamId: VctTeamId): CanonicalUrlState {
  return { ...state, teamA: teamId, regionA: regionForTeam(teamId) };
}

export function withRegionB(state: CanonicalUrlState, regionId: VctRegionId): CanonicalUrlState {
  return { ...state, regionB: regionId, teamB: null };
}

export function withTeamB(state: CanonicalUrlState, teamId: VctTeamId): CanonicalUrlState {
  return { ...state, teamB: teamId, regionB: regionForTeam(teamId) };
}

export function withMaps(
  state: CanonicalUrlState,
  mapIds: readonly string[],
  validMapIds: ReadonlySet<string>,
): CanonicalUrlState {
  const ordered = sortMapIdsCanonically(mapIds, validMapIds);
  const capped = state.format ? ordered.slice(0, SERIES_MAP_LIMITS[state.format]) : ordered;
  return { ...state, maps: capped };
}

export function withFormat(state: CanonicalUrlState, format: SeriesFormat): CanonicalUrlState {
  return { ...state, format, maps: state.maps.slice(0, SERIES_MAP_LIMITS[format]) };
}

/** Real-model integration task: never a reason to reset team/region/map/format selections — switching the prediction *source*, not the scenario, so a user comparing both modes for the same matchup doesn't lose their picks. */
export function withMode(state: CanonicalUrlState, mode: ScenarioMode): CanonicalUrlState {
  return { ...state, mode };
}
