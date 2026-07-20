"use client";

import { useMediaQuery } from "./useMediaQuery";

/**
 * TASK-051 — the one `prefers-reduced-motion` check every new motion
 * primitive in this module reads. Every primitive in this catalog must
 * branch on this (or accept a `disabled`/`reduced-motion fallback` prop that
 * ultimately reads it) and render its final, settled state immediately when
 * it is true: no parallax, no count-up, no pointer-follow, no sticky-scroll
 * dependence. This does not replace the global CSS safety net in
 * `tokens.css` (`@media (prefers-reduced-motion: reduce)`, which collapses
 * transition/animation durations site-wide) — it is the equivalent check for
 * motion driven by JavaScript (Framer Motion `animate`/`transform` writes,
 * IntersectionObserver-gated reveals) that the CSS rule cannot reach.
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
