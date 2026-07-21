"use client";

import { useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";

/**
 * TASK-053 — whole-page "has the user scrolled past `threshold`" boolean,
 * for a header that morphs from a transparent top-of-page state into a more
 * solid one. Reads Framer's own page-level `scrollY` (already a single
 * passive listener shared internally by every `useScroll()` caller on the
 * page) and only calls `setState` when the boolean actually flips, not on
 * every scroll frame — the same "update state at boundaries, not per frame"
 * pattern `StickyStory`'s `activeIndex` already established.
 *
 * Starts `false` on the server and on first client render (consistent with
 * every other capability hook in this module), then updates once real
 * scroll position is known.
 */
export function useScrolled(threshold = 32): boolean {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const next = latest > threshold;
    setScrolled((current) => (current === next ? current : next));
  });

  return scrolled;
}
