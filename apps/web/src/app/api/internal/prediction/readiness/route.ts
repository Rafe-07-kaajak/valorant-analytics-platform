import { NextResponse } from "next/server";
import { getRealPredictionReadiness } from "../../../../../server/prediction/readiness";
import { toPredictionApiError } from "../../../../../server/prediction/errors";

/** TASK-048: this route reads a filesystem-backed model/data source (directly or via `@repo/model-inference`) and must never run on the Edge runtime, which has no Node filesystem API. Explicit even though Next already defaults API routes to Node — see docs/36, "Edge rejection". */
export const runtime = "nodejs";

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
