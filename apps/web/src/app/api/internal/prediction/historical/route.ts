import { NextResponse } from "next/server";
import { predictHistoricalMatch } from "../../../../../server/prediction/predictionAdapter";
import { PredictionApiError, toPredictionApiError } from "../../../../../server/prediction/errors";

/**
 * POST-only historical-replay prediction endpoint — TASK-047 requirement
 * 15. Accepts only `{ mode, matchInternalId, requestId?, requestedModelVersion? }`
 * — a full feature row is never accepted from the browser (requirement 15,
 * "Never accept a raw full feature row from the browser for real-model
 * prediction").
 */

/** A historical-prediction request body is a handful of short string fields — this bound exists to reject an oversized/malformed payload before it is even parsed as JSON. */
const MAX_REQUEST_BYTES = 8_192;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const ALLOWED_BODY_KEYS = new Set(["mode", "matchInternalId", "requestId", "requestedModelVersion"]);

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
    if (body.mode !== "historical-real-model") {
      throw new PredictionApiError("request_invalid", 'Request "mode" must be "historical-real-model".');
    }
    if (body.requestId !== undefined && typeof body.requestId !== "string") {
      throw new PredictionApiError("request_invalid", 'Request "requestId" must be a string when provided.');
    }
    if (body.requestedModelVersion !== undefined && typeof body.requestedModelVersion !== "string") {
      throw new PredictionApiError("request_invalid", 'Request "requestedModelVersion" must be a string when provided.');
    }

    const result = await predictHistoricalMatch({
      matchInternalId: body.matchInternalId,
      requestId: body.requestId as string | undefined,
      requestedModelVersion: body.requestedModelVersion as string | undefined,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const apiError = toPredictionApiError(error);
    const requestId = isPlainObject(body) && typeof body.requestId === "string" ? body.requestId : undefined;
    return NextResponse.json(apiError.toSafeJSON(requestId), { status: apiError.httpStatus });
  }
}
