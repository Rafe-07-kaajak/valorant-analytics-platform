import type { Team } from "@repo/shared";
import type { VctTeam } from "../constants/vct";

/**
 * Adapts a TASK-030 `VctTeam` (this app's canonical identity) into the
 * generic `Team` shape the prediction-result UI (ResultHeader,
 * ProbabilityCard, MatchDnaSection, etc.) already expects, so none of that
 * UI needed to change to support the 32-team roster.
 */
export function toPredictionTeam(team: VctTeam): Team {
  return { id: team.id, name: team.name, region: team.region, logoUrl: team.logoPath };
}
