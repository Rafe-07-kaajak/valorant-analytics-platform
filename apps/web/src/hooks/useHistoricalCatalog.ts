"use client";

import { useCallback, useEffect, useState } from "react";
import type { HistoricalMatchSummary } from "@repo/shared";
import { fetchHistoricalCatalog } from "../lib/api/realPrediction";

type Status = "idle" | "loading" | "success" | "error";

/** Rows requested per "Load more" click — mirrors the server's own default `catalogLimit` page size. */
const PAGE_SIZE = 50;

/**
 * TASK-057 — the catalog endpoint bounds every response to a `limit`
 * (`config.ts`'s `catalogLimit`), so a dataset larger than one page was
 * previously invisible: the archive silently showed only its first (oldest)
 * page. `loadMore` re-requests from the beginning with a larger `limit`
 * rather than an offset/cursor — simplest correct approach given the
 * catalog's stable `(scheduledAt, matchInternalId)` sort, and avoids any
 * duplicate-row risk at a page boundary.
 */
export function useHistoricalCatalog(enabled: boolean) {
  const [status, setStatus] = useState<Status>("idle");
  const [matches, setMatches] = useState<readonly HistoricalMatchSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (limit: number) => {
    const catalog = await fetchHistoricalCatalog({ limit });
    setMatches(catalog.matches);
    setTotal(catalog.total);
  }, []);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      await load(PAGE_SIZE);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load historical matches.");
      setStatus("error");
    }
  }, [load]);

  const loadMore = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      await load(matches.length + PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load more historical matches.");
    } finally {
      setIsLoadingMore(false);
    }
  }, [load, matches.length]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  return { status, matches, total, isLoadingMore, error, refresh, loadMore };
}
