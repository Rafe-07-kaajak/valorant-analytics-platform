"use client";

import { useInView, type UseInViewOptions } from "framer-motion";
import type { RefObject } from "react";

export interface UseViewportEntryOptions {
  /** Stop observing after the first entry. Defaults to true (matches ScrollReveal's prior behavior). */
  once?: boolean;
  /** Fraction of the element that must be visible to count as "entered". Defaults to 0.2. */
  amount?: number | "some" | "all";
  /** Root-margin-style offset, e.g. "-80px" to trigger slightly before the element reaches the viewport edge. */
  margin?: UseInViewOptions["margin"];
}

/**
 * TASK-051 — the shared viewport-entry primitive behind every scroll-reveal
 * primitive in this module (StaggerGroup, TextLineReveal, ImageMaskReveal,
 * MotionNumber's trigger, StickyStory's non-sticky fallback). Wraps Framer
 * Motion's `useInView` (IntersectionObserver-backed, already a project
 * dependency) rather than hand-rolling a second IntersectionObserver
 * implementation — see docs/39 for why `ScrollReveal` itself keeps using
 * `whileInView` directly instead of this hook: it needs no boolean state at
 * all, so introducing one would be strictly more code for the same result.
 */
export function useViewportEntry(
  ref: RefObject<Element | null>,
  { once = true, amount = 0.2, margin }: UseViewportEntryOptions = {},
): boolean {
  return useInView(ref, { once, amount, margin });
}
