"use client";

import { useCallback, useEffect, useState } from "react";
import type { HistoricalMatchSummary } from "@repo/shared";
import { fetchHistoricalCatalog } from "../lib/api/realPrediction";

type Status = "idle" | "loading" | "success" | "error";

export function useHistoricalCatalog(enabled: boolean) {
  const [status, setStatus] = useState<Status>("idle");
  const [matches, setMatches] = useState<readonly HistoricalMatchSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const catalog = await fetchHistoricalCatalog();
      setMatches(catalog.matches);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load historical matches.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  return { status, matches, error, refresh };
}
