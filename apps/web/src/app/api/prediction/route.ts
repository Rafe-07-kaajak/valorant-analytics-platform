import { NextResponse } from "next/server";
import type { PredictionRequest } from "@repo/shared";
import { generatePrediction, validateScenario } from "@repo/prediction-engine";

export async function POST(req: Request) {
  let body: PredictionRequest;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const validationError = validateScenario(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const result = generatePrediction(body);
    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Unable to generate a prediction for this scenario." }, { status: 500 });
  }
}
