import { NextResponse } from "next/server";
import type { PredictionRequest } from "@repo/shared";
import { generateVctPrediction, validateVctScenario } from "@repo/prediction-engine";
import { getTeamById, type VctTeamId } from "../../../constants/vct";
import { toPredictionTeam } from "../../../lib/toPredictionTeam";

/**
 * TASK-032 counterpart to `/api/prediction`, for the TASK-031 32-team
 * roster. `/api/prediction` is left untouched and still serves the
 * original 8-team dataset. Display identity (name/region/logo) is resolved
 * here from TASK-030's web directory — the only place that identity is
 * allowed to originate from — and handed to the engine, which never
 * imports from this app.
 */
export async function POST(req: Request) {
  let body: PredictionRequest;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const validationError = validateVctScenario(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const teamA = getTeamById(body.scenario.teamAId as VctTeamId);
  const teamB = getTeamById(body.scenario.teamBId as VctTeamId);
  if (!teamA || !teamB) {
    return NextResponse.json({ error: "Unknown VCT team in scenario." }, { status: 400 });
  }

  try {
    const result = generateVctPrediction(body, toPredictionTeam(teamA), toPredictionTeam(teamB));
    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Unable to generate a prediction for this scenario." }, { status: 500 });
  }
}
