import type { CurrentPredictionResponse, PredictionResult, RealAxisKey, SimulationResult, VctProfileAdjustment } from "@repo/shared";
import { expectedWinProbabilityFromElo } from "./eloFormula";
import {
  buildExplanation,
  buildInsights,
  buildKeyFactors,
  buildMatchDna,
  buildTeamDnaFromValues,
  coreFromResponse,
  ELO_SCALE_SPAN,
  scaleTeamStateToAxisValues,
  type RealResultCore,
} from "./presentationAdapter";

/**
 * Real Model 2.0's What-if Simulator recompute. Deliberately client-side and
 * synchronous — no API call, never the synthetic `/api/simulate-prediction`
 * route, never `generateVctPrediction`. `eloStrength` is the only axis that
 * genuinely feeds the deployed `elo-baseline` estimator (the real Elo
 * formula, applied to the same baseline calibration offset the actual
 * response carried); every other axis delta only changes the recomputed
 * `TeamDna`/`MatchDna`/Key Factors/explanation — real, honest recomputation
 * of supporting context, never the headline probability.
 */
export function simulateRealModel2(
  baselineResponse: CurrentPredictionResponse,
  baselineResult: PredictionResult,
  teamAName: string,
  teamBName: string,
  teamAAdjustment: VctProfileAdjustment,
  teamBAdjustment: VctProfileAdjustment,
  requestId: string,
): SimulationResult {
  const teamABaselineValues = scaleTeamStateToAxisValues(baselineResponse.teamAState);
  const teamBBaselineValues = scaleTeamStateToAxisValues(baselineResponse.teamBState);

  const teamASimulatedValues = applyAxisDeltas(teamABaselineValues, teamAAdjustment);
  const teamBSimulatedValues = applyAxisDeltas(teamBBaselineValues, teamBAdjustment);

  const teamADna = buildTeamDnaFromValues(baselineResponse.teamAId, teamASimulatedValues);
  const teamBDna = buildTeamDnaFromValues(baselineResponse.teamBId, teamBSimulatedValues);
  const matchDna = buildMatchDna(teamADna, teamBDna);

  // Only the Elo axis's *display* delta is converted back to raw Elo points
  // and re-run through the real Elo formula — every other axis only affects
  // the recomputed profile/context above, never this probability.
  const rawEloDeltaA = ((teamASimulatedValues.eloStrength - teamABaselineValues.eloStrength) / 100) * ELO_SCALE_SPAN;
  const rawEloDeltaB = ((teamBSimulatedValues.eloStrength - teamBBaselineValues.eloStrength) / 100) * ELO_SCALE_SPAN;
  const hypotheticalEloA = baselineResponse.teamAState.eloRating + rawEloDeltaA;
  const hypotheticalEloB = baselineResponse.teamBState.eloRating + rawEloDeltaB;
  const uncalibratedTeamAProbability = expectedWinProbabilityFromElo(hypotheticalEloA, hypotheticalEloB);
  // Reapplies the baseline's own calibration adjustment as a constant offset
  // — exact only when calibration is linear/additive (true for the deployed
  // "none" method); documented as an approximation for any other method.
  const teamAWinProbability = Math.min(1, Math.max(0, uncalibratedTeamAProbability + baselineResponse.contribution.calibrationAdjustment));
  const teamBWinProbability = 1 - teamAWinProbability;
  const confidence = Math.min(1, Math.max(0, Math.abs(teamAWinProbability - 0.5) * 2));

  const core: RealResultCore = {
    ...coreFromResponse(baselineResponse),
    driverDifferential: hypotheticalEloA - hypotheticalEloB,
    confidence,
    teamAWinProbability,
  };

  const keyFactors = buildKeyFactors(core, teamADna, teamBDna);
  const insights = buildInsights(core, teamAName, teamBName, keyFactors);
  const explanation = buildExplanation(core, teamAName, teamBName, keyFactors);

  const simulatedResult: PredictionResult = {
    ...baselineResult,
    outcomes: [
      { teamId: baselineResponse.teamAId, winProbability: teamAWinProbability },
      { teamId: baselineResponse.teamBId, winProbability: teamBWinProbability },
    ],
    predictedWinnerId: teamAWinProbability >= 0.5 ? baselineResponse.teamAId : baselineResponse.teamBId,
    confidence: Math.round(confidence * 100),
    // Evidence trust reflects how much real match history backs this
    // matchup — a hypothetical input tweak doesn't change that, so it stays
    // equal to the baseline's real evidence trust score.
    trustScore: baselineResult.trustScore,
    explanation,
    teamDna: [teamADna, teamBDna],
    matchDna,
    keyFactors,
    insights,
  };

  return {
    simulationId: crypto.randomUUID(),
    requestId,
    result: simulatedResult,
    teamAAdjustment,
    teamBAdjustment,
    generatedAt: new Date().toISOString(),
  };
}

function applyAxisDeltas(baselineValues: Record<RealAxisKey, number>, adjustment: VctProfileAdjustment): Record<RealAxisKey, number> {
  const values = { ...baselineValues };
  for (const [key, delta] of Object.entries(adjustment.dna)) {
    if (typeof delta !== "number") continue;
    if (!(key in values)) continue;
    const axisKey = key as RealAxisKey;
    values[axisKey] = Math.min(100, Math.max(0, baselineValues[axisKey] + delta));
  }
  return values;
}
