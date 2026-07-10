import type { PredictionRequest, PredictionResult } from "@repo/shared";

export async function predictMatch(request: PredictionRequest): Promise<PredictionResult> {
  const response = await fetch("/api/prediction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "Prediction request failed.");
  }

  return payload as PredictionResult;
}
