"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  parsePowerRankingsUrlState,
  powerRankingsUrlStatesEqual,
  serializePowerRankingsUrlState,
  type PowerRankingsUrlState,
} from "./rankingUrlState";

/**
 * Structural adaptation of `useCanonicalUrlState`'s two-way URL<->state sync
 * (same two-ref/skip-on-mount/`router.replace` mechanics) for
 * `PowerRankingsUrlState`. Kept in its own `"use client"` module, separate
 * from `rankingUrlState.ts`'s plain parse/serialize functions — those are
 * called from the server page component, and a single `"use client"` file
 * would mark every export (including the plain functions) as client-only,
 * which Next.js rejects when a Server Component calls them directly.
 */
export function usePowerRankingsUrlState(
  initialState: PowerRankingsUrlState,
): [PowerRankingsUrlState, Dispatch<SetStateAction<PowerRankingsUrlState>>] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [state, setState] = useState<PowerRankingsUrlState>(initialState);
  const lastRawSearch = useRef(searchParams.toString());
  const lastSyncedQuery = useRef(serializePowerRankingsUrlState(initialState));
  const isFirstRender = useRef(true);

  useEffect(() => {
    const rawSearch = searchParams.toString();
    if (rawSearch === lastRawSearch.current) return;

    lastRawSearch.current = rawSearch;
    const reparsed = parsePowerRankingsUrlState(searchParams);
    lastSyncedQuery.current = serializePowerRankingsUrlState(reparsed);
    setState((current) => (powerRankingsUrlStatesEqual(current, reparsed) ? current : reparsed));
  }, [searchParams]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const nextQuery = serializePowerRankingsUrlState(state);
    if (nextQuery === lastSyncedQuery.current) return;

    lastSyncedQuery.current = nextQuery;
    lastRawSearch.current = nextQuery;
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pathname/router are stable for this route.
  }, [state]);

  return [state, setState];
}
