"use client";

import { useCallback, useState } from "react";
import type { CurrentPredictionRequest, CurrentPredictionResponse } from "@repo/shared";
import { predictCurrentMatch } from "../lib/api/realPrediction";

type Status = "idle" | "loading" | "success" | "error";

/** Real-model integration task: mirrors `usePrediction`'s exact shape so `PredictionStudioClient` can hold both modes side by side without inventing a second pattern — but a wholly separate result/error state, so a real-mode failure never falls back to (or is confused with) a synthetic result. */
export function useCurrentRealPrediction() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<CurrentPredictionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestPrediction = useCallback(async (request: Omit<CurrentPredictionRequest, "mode" | "requestId">) => {
    setStatus("loading");
    setError(null);
    setResult(null);

    try {
      const prediction = await predictCurrentMatch({ ...request, requestId: crypto.randomUUID() });
      setResult(prediction);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
  }, []);

  return { status, result, error, requestPrediction, reset };
}
