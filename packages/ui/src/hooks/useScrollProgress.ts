"use client";

import { useScroll, type MotionValue, type UseScrollOptions } from "framer-motion";
import type { RefObject } from "react";

export interface UseScrollProgressOptions {
  /** Omit for whole-page scroll progress; pass a ref for section-local (StickyStory) progress. */
  target?: RefObject<HTMLElement | null>;
  /** Framer's scroll-offset tuple. Defaults to the element entering at the bottom and leaving at the top. */
  offset?: UseScrollOptions["offset"];
}

/**
 * TASK-051 — scroll-progress primitive shared by `ScrollProgress` and
 * `StickyStory`. Returns Framer Motion's `MotionValue<number>` directly
 * (0 to 1) rather than plain React state: a consumer binds it to a style
 * (`scaleX`, `opacity`) or subscribes via `useTransform`/
 * `useMotionValueEvent`, so scrolling never triggers a React re-render on
 * its own — the performance guardrail against a full-page re-render on
 * scroll. Framer's `useScroll` is already IntersectionObserver/rAF-driven
 * internally with a passive scroll listener, so this does not add a second
 * document scroll listener.
 */
export function useScrollProgress({ target, offset }: UseScrollProgressOptions = {}): MotionValue<number> {
  const { scrollYProgress } = useScroll(
    target ? { target, offset: offset ?? ["start end", "end start"] } : {},
  );
  return scrollYProgress;
}
