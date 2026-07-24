import { NextResponse } from "next/server";
import { predictCurrentMatch } from "../../../../../server/prediction/currentPredictionAdapter";
import { PredictionApiError, toPredictionApiError } from "../../../../../server/prediction/errors";

/** Reads a filesystem-backed real dataset/model — must never run on the Edge runtime, which has no Node filesystem API (mirrors `historical/route.ts`). */
export const runtime = "nodejs";

/**
 * POST-only real "current matchup" prediction endpoint — real-model
 * integration for Prediction Studio's main flow. Accepts only
 * `{ mode, teamAId, teamBId, seriesFormat, tournamentTier, eventRegion?, requestId? }`
 * — never a raw feature row from the browser, mirroring `historical/route.ts`'s
 * own strict allowlist.
 */

const MAX_REQUEST_BYTES = 8_192;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const ALLOWED_BODY_KEYS = new Set(["mode", "teamAId", "teamBId", "seriesFormat", "tournamentTier", "eventRegion", "requestId"]);

export async function POST(request: Request) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ code: "request_invalid", message: "Unable to read request body.", retryable: false }, { status: 400 });
  }

  if (Buffer.byteLength(rawBody, "utf-8") > MAX_REQUEST_BYTES) {
    return NextResponse.json({ code: "request_invalid", message: "Request payload is too large.", retryable: false }, { status: 413 });
  }

  let body: unknown;
  try {
    body = rawBody.length > 0 ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ code: "request_invalid", message: "Request body must be valid JSON.", retryable: false }, { status: 400 });
  }

  try {
    if (!isPlainObject(body)) {
      throw new PredictionApiError("request_invalid", "Request body must be a JSON object.");
    }
    for (const key of Object.keys(body)) {
      if (!ALLOWED_BODY_KEYS.has(key)) {
        throw new PredictionApiError("request_invalid", `Unrecognized field "${key}" is not permitted.`);
      }
    }
    if (body.mode !== "current-real-model") {
      throw new PredictionApiError("request_invalid", 'Request "mode" must be "current-real-model".');
    }
    if (body.requestId !== undefined && typeof body.requestId !== "string") {
      throw new PredictionApiError("request_invalid", 'Request "requestId" must be a string when provided.');
    }

    const result = await predictCurrentMatch({
      teamAId: body.teamAId,
      teamBId: body.teamBId,
      seriesFormat: body.seriesFormat,
      tournamentTier: body.tournamentTier,
      eventRegion: body.eventRegion,
      requestId: body.requestId as string | undefined,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const apiError = toPredictionApiError(error);
    const requestId = isPlainObject(body) && typeof body.requestId === "string" ? body.requestId : undefined;
    return NextResponse.json(apiError.toSafeJSON(requestId), { status: apiError.httpStatus });
  }
}
