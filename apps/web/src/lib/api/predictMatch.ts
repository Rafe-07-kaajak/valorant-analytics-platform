import type { PredictionRequest, PredictionResult } from "@repo/shared";

const CLIENT_VERSION = "web-0.1.0";

export async function predictMatch(
  request: Omit<PredictionRequest, "clientVersion" | "timestamp">,
): Promise<PredictionResult> {
  const body: PredictionRequest = {
    ...request,
    clientVersion: CLIENT_VERSION,
    timestamp: new Date().toISOString(),
  };

  const response = await fetch("/api/prediction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "Prediction request failed.");
  }

  return payload as PredictionResult;
}
