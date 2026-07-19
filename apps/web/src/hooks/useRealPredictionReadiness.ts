"use client";

import { useCallback, useEffect, useState } from "react";
import type { RealPredictionReadiness } from "@repo/shared";
import { fetchRealPredictionReadiness } from "../lib/api/realPrediction";

type Status = "loading" | "success" | "error";

export function useRealPredictionReadiness() {
  const [status, setStatus] = useState<Status>("loading");
  const [readiness, setReadiness] = useState<RealPredictionReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const result = await fetchRealPredictionReadiness();
      setReadiness(result);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to check historical model availability.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, readiness, error, refresh };
}
