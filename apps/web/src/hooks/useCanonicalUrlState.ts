"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  canonicalStatesEqual,
  parseUrlState,
  serializeUrlState,
  type CanonicalFieldKey,
  type CanonicalUrlState,
} from "../lib/urlState";

/**
 * Bidirectional sync between a feature's local canonical selection state and
 * its route's query string (TASK-039).
 *
 * - State → URL: on every local state change (after the initial mount —
 *   loading a page never itself rewrites the address bar, only a
 *   subsequent user interaction does), `router.replace` is used so rapid
 *   selection changes don't flood browser history.
 * - URL → state: browser back/forward (or any external navigation that
 *   changes this route's search params) re-parses and updates local state.
 *
 * Two refs track sync state, deliberately kept separate because the raw URL
 * and its canonical serialization can be the same query in a different
 * parameter order:
 * - `lastRawSearch` — the exact `searchParams.toString()` last seen, so
 *   effect (1) only reparses when the URL genuinely changed underneath it.
 * - `lastSyncedQuery` — the canonical serialization last believed to be
 *   current, so effect (2) doesn't re-issue a `replace` for a URL that
 *   already (canonically) matches, even if its raw parameter order differs.
 *
 * Without this split, reconciling an externally-changed URL (back/forward)
 * into state could immediately trigger a second, unwanted `replace` just to
 * re-order parameters into canonical form.
 *
 * `fields` is both the set this route reads on init and the complete set it
 * owns when writing — any other query parameter (a canonical field this
 * route doesn't understand, or a genuinely unrecognized one) is dropped the
 * first time local state is synced back to the URL, keeping every URL a
 * route generates fully self-consistent.
 */
export function useCanonicalUrlState(
  initialState: CanonicalUrlState,
  fields: readonly CanonicalFieldKey[],
  validMapIds: ReadonlySet<string>,
): [CanonicalUrlState, Dispatch<SetStateAction<CanonicalUrlState>>] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [state, setState] = useState<CanonicalUrlState>(initialState);
  const lastRawSearch = useRef(searchParams.toString());
  const lastSyncedQuery = useRef(serializeUrlState(initialState, fields));
  const isFirstRender = useRef(true);

  // URL -> state (back/forward navigation, or any external change to this route's query).
  useEffect(() => {
    const rawSearch = searchParams.toString();
    if (rawSearch === lastRawSearch.current) return;

    lastRawSearch.current = rawSearch;
    const reparsed = parseUrlState(searchParams, { validMapIds });
    lastSyncedQuery.current = serializeUrlState(reparsed, fields);
    setState((current) => (canonicalStatesEqual(current, reparsed) ? current : reparsed));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `validMapIds`/`fields` are stable for a given route; re-running this effect for them is unnecessary.
  }, [searchParams]);

  // state -> URL (user interaction). Skipped on mount so simply loading a
  // page — even one whose URL needed repair — never itself issues a replace.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const nextQuery = serializeUrlState(state, fields);
    if (nextQuery === lastSyncedQuery.current) return;

    lastSyncedQuery.current = nextQuery;
    lastRawSearch.current = nextQuery;
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `fields`/`pathname`/`router` are stable for a given route.
  }, [state]);

  return [state, setState];
}
