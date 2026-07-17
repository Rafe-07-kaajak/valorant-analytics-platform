import type { SimulationRequest, SimulationResult } from "@repo/shared";

const CLIENT_VERSION = "web-0.1.0";

/**
 * TASK-038 counterpart to `predictMatch.ts`, targeting the additive
 * `/api/simulate-prediction` route. `/api/vct-prediction` and `predictMatch`
 * are untouched — this is a separate request for a separate, explicitly
 * hypothetical result.
 */
export async function simulatePrediction(
  request: Omit<SimulationRequest, "clientVersion" | "timestamp">,
): Promise<SimulationResult> {
  const body: SimulationRequest = {
    ...request,
    clientVersion: CLIENT_VERSION,
    timestamp: new Date().toISOString(),
  };

  const response = await fetch("/api/simulate-prediction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "Simulation request failed.");
  }

  return payload as SimulationResult;
}
