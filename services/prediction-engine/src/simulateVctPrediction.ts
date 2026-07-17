import type { PredictionResult, SimulationRequest, Team, VctProfileAdjustment } from "@repo/shared";
import type { VctTeamId } from "./data/vctTeams";
import { computeVctPredictionFromProfiles } from "./generateVctPrediction";
import { applyVctProfileAdjustment } from "./lib/vctProfileAdjustment";
import { getVctTeamProfile } from "./lib/vctTeamProfiles";

/**
 * TASK-038 isolated What-if Simulator path. Baseline profiles are read from
 * the frozen `VCT_TEAM_PROFILES` registry exactly like the production path
 * (`generateVctPrediction`), then cloned and adjusted — the registry itself
 * is never touched, and there is no module-level mutable state here, so
 * concurrent simulations (different requests, different adjustment
 * payloads) can never observe or leak into each other's clones.
 *
 * `computeVctPredictionFromProfiles` — the exact same function the
 * production path calls — computes the result, so no prediction formula is
 * duplicated here. This function is deterministic for the same scenario and
 * adjustment payload: no caching, no randomness beyond the same
 * `predictionId`/`generatedAt` stamping every prediction already gets.
 *
 * Callers must validate `request`/`teamAAdjustment`/`teamBAdjustment` with
 * `validateSimulationRequest` first — this function assumes already-validated,
 * bounds-checked input and does not re-validate.
 */
export function simulateVctPrediction(
  request: SimulationRequest,
  teamA: Team,
  teamB: Team,
  teamAAdjustment: VctProfileAdjustment,
  teamBAdjustment: VctProfileAdjustment,
): PredictionResult {
  const { scenario } = request;
  if (teamA.id !== scenario.teamAId || teamB.id !== scenario.teamBId) {
    throw new Error("Resolved team identity does not match the submitted scenario.");
  }

  const baselineProfileA = getVctTeamProfile(teamA.id as VctTeamId);
  const baselineProfileB = getVctTeamProfile(teamB.id as VctTeamId);
  if (!baselineProfileA || !baselineProfileB) {
    throw new Error("Unknown VCT team in scenario.");
  }

  const simulatedProfileA = applyVctProfileAdjustment(baselineProfileA, teamAAdjustment);
  const simulatedProfileB = applyVctProfileAdjustment(baselineProfileB, teamBAdjustment);

  return computeVctPredictionFromProfiles(request, teamA, teamB, simulatedProfileA, simulatedProfileB);
}
