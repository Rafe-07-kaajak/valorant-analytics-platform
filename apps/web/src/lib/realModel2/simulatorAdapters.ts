import type { CurrentPredictionResponse, PredictionResult, SimulationResult, VctProfileAdjustment } from "@repo/shared";
import type { SimulatorBaseline } from "../../features/prediction-studio/simulator/WhatIfSimulator";
import { scaleTeamStateToAxisValues } from "./presentationAdapter";
import { simulateRealModel2 } from "./simulate";

/**
 * Real Model 2.0's `WhatIfSimulator` injection points. `getBaseline` needs
 * no network call at all — every real value it displays was already
 * returned in the baseline `CurrentPredictionResponse`. `runSimulation`
 * never calls `/api/simulate-prediction`; it's a pure, synchronous, real
 * recompute (`simulateRealModel2`), wrapped in a resolved Promise only to
 * match `WhatIfSimulatorProps`'s async signature.
 */
function roundValues(values: Record<string, number>): Record<string, number> {
  const rounded: Record<string, number> = {};
  for (const [key, value] of Object.entries(values)) rounded[key] = Math.round(value);
  return rounded;
}

export function buildRealSimulatorBaseline(response: CurrentPredictionResponse): SimulatorBaseline {
  return {
    teamA: { values: roundValues(scaleTeamStateToAxisValues(response.teamAState)), mapStrength: {} },
    teamB: { values: roundValues(scaleTeamStateToAxisValues(response.teamBState)), mapStrength: {} },
  };
}

export function createRealRunSimulation(
  response: CurrentPredictionResponse,
  baselineResult: PredictionResult,
  teamAName: string,
  teamBName: string,
): (teamAAdjustment: VctProfileAdjustment, teamBAdjustment: VctProfileAdjustment, requestId: string) => Promise<SimulationResult> {
  return async (teamAAdjustment, teamBAdjustment, requestId) =>
    simulateRealModel2(response, baselineResult, teamAName, teamBName, teamAAdjustment, teamBAdjustment, requestId);
}
