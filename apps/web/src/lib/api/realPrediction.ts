import type { HistoricalCatalogResponse, HistoricalPredictionRequest, HistoricalPredictionResponse, PredictionApiErrorPayload, RealPredictionReadiness } from "@repo/shared";

/**
 * Thin browser-side client for TASK-047's real (historical-replay)
 * prediction routes — mirrors the existing `lib/api/predictMatch.ts`
 * pattern (fetch + throw a readable `Error` on failure) so the new hooks
 * below can follow the same shape as `usePrediction`.
 */

export class RealPredictionApiError extends Error {
  readonly code: PredictionApiErrorPayload["code"];
  readonly retryable: boolean;

  constructor(payload: PredictionApiErrorPayload) {
    super(payload.message);
    this.name = "RealPredictionApiError";
    this.code = payload.code;
    this.retryable = payload.retryable;
  }
}

async function parseErrorPayload(response: Response): Promise<PredictionApiErrorPayload> {
  try {
    return (await response.json()) as PredictionApiErrorPayload;
  } catch {
    return { code: "internal_error", message: "An unexpected error occurred.", retryable: false };
  }
}

export async function fetchRealPredictionReadiness(): Promise<RealPredictionReadiness> {
  const response = await fetch("/api/internal/prediction/readiness");
  if (!response.ok) throw new RealPredictionApiError(await parseErrorPayload(response));
  return (await response.json()) as RealPredictionReadiness;
}

export interface FetchHistoricalCatalogParams {
  readonly eventFamily?: string;
  readonly limit?: number;
}

export async function fetchHistoricalCatalog(params: FetchHistoricalCatalogParams = {}): Promise<HistoricalCatalogResponse> {
  const searchParams = new URLSearchParams();
  if (params.eventFamily) searchParams.set("eventFamily", params.eventFamily);
  if (params.limit) searchParams.set("limit", String(params.limit));
  const query = searchParams.toString();

  const response = await fetch(`/api/internal/prediction/catalog${query ? `?${query}` : ""}`);
  if (!response.ok) throw new RealPredictionApiError(await parseErrorPayload(response));
  return (await response.json()) as HistoricalCatalogResponse;
}

export async function predictHistoricalMatch(
  request: Omit<HistoricalPredictionRequest, "mode">,
): Promise<HistoricalPredictionResponse> {
  const body: HistoricalPredictionRequest = { mode: "historical-real-model", ...request };

  const response = await fetch("/api/internal/prediction/historical", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new RealPredictionApiError(await parseErrorPayload(response));
  return (await response.json()) as HistoricalPredictionResponse;
}
