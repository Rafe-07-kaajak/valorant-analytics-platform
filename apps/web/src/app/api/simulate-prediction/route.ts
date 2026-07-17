import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { SimulationRequest, SimulationResult } from "@repo/shared";
import { simulateVctPrediction, validateSimulationRequest } from "@repo/prediction-engine";
import { getTeamById, type VctTeamId } from "../../../constants/vct";
import { toPredictionTeam } from "../../../lib/toPredictionTeam";

/**
 * TASK-038 What-if Simulator endpoint — additive alongside `/api/vct-prediction`,
 * which is untouched and still serves the default prediction path. Runs the
 * exact same scenario validation as `/api/vct-prediction` plus adjustment
 * validation (`validateSimulationRequest`), then computes a hypothetical
 * prediction through `simulateVctPrediction`'s isolated clone-and-adjust
 * path — `VCT_TEAM_PROFILES` itself is never touched by this route.
 */
export async function POST(req: Request) {
  let body: SimulationRequest;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const validationError = validateSimulationRequest(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const teamA = getTeamById(body.scenario.teamAId as VctTeamId);
  const teamB = getTeamById(body.scenario.teamBId as VctTeamId);
  if (!teamA || !teamB) {
    return NextResponse.json({ error: "Unknown VCT team in scenario." }, { status: 400 });
  }

  try {
    const result = simulateVctPrediction(
      body,
      toPredictionTeam(teamA),
      toPredictionTeam(teamB),
      body.teamAAdjustment,
      body.teamBAdjustment,
    );

    const simulationResult: SimulationResult = {
      simulationId: randomUUID(),
      requestId: body.requestId,
      result,
      teamAAdjustment: body.teamAAdjustment,
      teamBAdjustment: body.teamBAdjustment,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(simulationResult, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Unable to simulate a prediction for this scenario." }, { status: 500 });
  }
}
