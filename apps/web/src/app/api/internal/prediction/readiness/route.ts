import { NextResponse } from "next/server";
import { getRealPredictionReadiness } from "../../../../../server/prediction/readiness";
import { toPredictionApiError } from "../../../../../server/prediction/errors";

/**
 * GET-only readiness endpoint — TASK-047 requirement 16. Never disables
 * synthetic scenario mode: this only informs the UI whether to offer
 * "Historical Model Replay".
 */
export async function GET() {
  try {
    const readiness = await getRealPredictionReadiness();
    return NextResponse.json(readiness, { status: 200 });
  } catch (error) {
    const apiError = toPredictionApiError(error);
    return NextResponse.json(apiError.toSafeJSON(), { status: apiError.httpStatus });
  }
}
