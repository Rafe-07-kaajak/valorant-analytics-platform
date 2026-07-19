"use client";

import { useCallback, useState } from "react";
import type { HistoricalPredictionResponse } from "@repo/shared";
import { predictHistoricalMatch } from "../lib/api/realPrediction";

type Status = "idle" | "loading" | "success" | "error";

export function useHistoricalPrediction() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<HistoricalPredictionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestPrediction = useCallback(async (matchInternalId: string) => {
    setStatus("loading");
    setError(null);
    setResult(null);

    try {
      const prediction = await predictHistoricalMatch({ matchInternalId, requestId: crypto.randomUUID() });
      setResult(prediction);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }, []);

  const clear = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
  }, []);

  return { status, result, error, requestPrediction, clear };
}
