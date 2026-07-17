import type { Scenario } from "@repo/shared";
import { getTeamById, type VctTeamId } from "../../constants/vct";
import type { CanonicalUrlState } from "./types";

/**
 * Projects a generated prediction's authoritative `Scenario` into canonical
 * URL state — used for the result-level cross-feature links (TASK-039
 * requirement 8), which must always reflect the result that was actually
 * generated, never the draft controls or any What-if Simulator adjustment.
 * A scenario's team ids are already validated by the prediction engine, so
 * this only derives each team's region — it doesn't re-validate.
 */
export function scenarioToCanonicalState(scenario: Scenario): CanonicalUrlState {
  const teamA = scenario.teamAId as VctTeamId;
  const teamB = scenario.teamBId as VctTeamId;

  return {
    regionA: getTeamById(teamA)?.region ?? null,
    teamA,
    regionB: getTeamById(teamB)?.region ?? null,
    teamB,
    maps: [...scenario.mapIds],
    format: scenario.seriesFormat,
  };
}
