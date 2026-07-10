import { NextResponse } from "next/server";
import type { PredictionRequest } from "@repo/shared";
import { mockTeams } from "../../../lib/mock/teams";
import { mockMaps } from "../../../lib/mock/maps";
import { generateMockPrediction } from "../../../lib/mock/generatePrediction";

const SERIES_MAP_LIMITS = { BO3: 3, BO5: 5 } as const;

function validate(request: PredictionRequest): string | null {
  const { scenario } = request;

  if (!scenario.teamAId || !scenario.teamBId) {
    return "Both teams are required.";
  }
  if (scenario.teamAId === scenario.teamBId) {
    return "Team A and Team B must be different.";
  }
  if (!mockTeams.some((team) => team.id === scenario.teamAId)) {
    return "Team A is not a known team.";
  }
  if (!mockTeams.some((team) => team.id === scenario.teamBId)) {
    return "Team B is not a known team.";
  }
  if (scenario.seriesFormat !== "BO3" && scenario.seriesFormat !== "BO5") {
    return "Series format must be BO3 or BO5.";
  }
  if (scenario.mapIds.length === 0) {
    return "At least one map is required.";
  }
  if (new Set(scenario.mapIds).size !== scenario.mapIds.length) {
    return "Maps must not be duplicated.";
  }
  if (scenario.mapIds.length > SERIES_MAP_LIMITS[scenario.seriesFormat]) {
    return `${scenario.seriesFormat} supports at most ${SERIES_MAP_LIMITS[scenario.seriesFormat]} maps.`;
  }
  if (!scenario.mapIds.every((mapId) => mockMaps.some((map) => map.id === mapId))) {
    return "One or more selected maps are not supported.";
  }

  return null;
}

export async function POST(req: Request) {
  let body: PredictionRequest;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const validationError = validate(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const result = generateMockPrediction(body);
  return NextResponse.json(result, { status: 200 });
}
