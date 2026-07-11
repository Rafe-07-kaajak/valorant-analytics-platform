"use client";

import { useCallback, useState } from "react";
import type { PredictionResult, Scenario } from "@repo/shared";
import { predictMatch } from "../lib/api/predictMatch";

type Status = "idle" | "loading" | "success" | "error";

export function usePrediction() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestPrediction = useCallback(async (scenario: Scenario) => {
    setStatus("loading");
    setError(null);
    setResult(null);

    try {
      const prediction = await predictMatch({ requestId: crypto.randomUUID(), scenario });
      setResult(prediction);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }, []);

  return { status, result, error, requestPrediction };
}
