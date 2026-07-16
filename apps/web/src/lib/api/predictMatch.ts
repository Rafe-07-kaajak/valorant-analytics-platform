import type { PredictionRequest, PredictionResult } from "@repo/shared";

const CLIENT_VERSION = "web-0.1.0";

/**
 * Prediction Studio's scenario shape (`Scenario.teamAId`/`teamBId`) is a
 * plain string, so it's unchanged by TASK-032 — only the target route moved,
 * from the original 8-team `/api/prediction` (still fully intact and
 * independently usable) to the TASK-031 32-team roster's `/api/vct-prediction`.
 */
export async function predictMatch(
  request: Omit<PredictionRequest, "clientVersion" | "timestamp">,
): Promise<PredictionResult> {
  const body: PredictionRequest = {
    ...request,
    clientVersion: CLIENT_VERSION,
    timestamp: new Date().toISOString(),
  };

  const response = await fetch("/api/vct-prediction", {
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
