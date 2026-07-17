import type { VctProfileBaselineRequest, VctProfileBaselineResponse } from "@repo/shared";

/**
 * TASK-038 counterpart to `predictMatch.ts`/`simulatePrediction.ts`, for the
 * read-only `/api/vct-profile-baseline` endpoint the What-if Simulator calls
 * once on mount.
 */
export async function getVctProfileBaseline(request: VctProfileBaselineRequest): Promise<VctProfileBaselineResponse> {
  const response = await fetch("/api/vct-profile-baseline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to load baseline profile values.");
  }

  return payload as VctProfileBaselineResponse;
}
