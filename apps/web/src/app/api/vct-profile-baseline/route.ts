import { NextResponse } from "next/server";
import type { VctProfileBaselineRequest, VctProfileBaselineResponse } from "@repo/shared";
import { getVctProfileBaseline, maps as supportedMaps } from "@repo/prediction-engine";
import type { VctTeamId } from "../../../constants/vct";

/**
 * TASK-038. Read-only, additive endpoint the What-if Simulator calls once on
 * mount to show honest baseline values next to every slider — before any
 * simulation has run. Returns only the narrow `VctProfileBaseline`
 * projection (`getVctProfileBaseline`), never a full `VctTeamProfile`.
 */
export async function POST(req: Request) {
  let body: VctProfileBaselineRequest;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!body?.teamAId || !body?.teamBId || !Array.isArray(body.mapIds)) {
    return NextResponse.json({ error: "teamAId, teamBId, and mapIds are required." }, { status: 400 });
  }

  const mapIds = body.mapIds.filter(
    (mapId): mapId is string => typeof mapId === "string" && supportedMaps.some((map) => map.id === mapId),
  );

  const teamA = getVctProfileBaseline(body.teamAId as VctTeamId, mapIds);
  const teamB = getVctProfileBaseline(body.teamBId as VctTeamId, mapIds);

  if (!teamA || !teamB) {
    return NextResponse.json({ error: "Unknown VCT team." }, { status: 400 });
  }

  const response: VctProfileBaselineResponse = { teamA, teamB };
  return NextResponse.json(response, { status: 200 });
}
