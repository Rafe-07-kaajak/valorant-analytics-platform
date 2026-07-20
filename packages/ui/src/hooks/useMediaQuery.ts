"use client";

import { useEffect, useState } from "react";

/**
 * TASK-051 — the one shared `matchMedia` subscription primitive. Every
 * capability check in the motion system (reduced motion, fine pointer,
 * hover support, breakpoint gating) is a media query, so this is the single
 * place that owns the "subscribe, read, cleanup" boilerplate instead of each
 * hook reimplementing it.
 *
 * Always returns `false` on the first render (server and pre-hydration
 * client render agree, so there is no hydration mismatch) and updates
 * synchronously after mount once the real value is known. Consumers that
 * need to react to a "reduced motion" or "coarse pointer" query should treat
 * that first `false` render as the safe default: motion enabled, capability
 * assumed absent, never the other way around, so nothing renders motion the
 * user asked to avoid.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mediaQueryList = window.matchMedia(query);
    setMatches(mediaQueryList.matches);

    const handleChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQueryList.addEventListener("change", handleChange);
    return () => mediaQueryList.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}
