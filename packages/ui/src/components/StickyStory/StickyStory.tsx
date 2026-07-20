"use client";

import { useMotionValueEvent } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { useScrollProgress } from "../../hooks/useScrollProgress";

export interface StickyStoryProps {
  /**
   * One entry per scene. Always rendered in normal document flow as the
   * accessible content — this is the only content a screen reader or a
   * reduced-motion/mobile visitor ever encounters, so it must be complete on
   * its own, not a caption for the sticky panel.
   */
  steps: ReactNode[];
  /**
   * Renders the sticky companion panel for the currently active step index.
   * Purely decorative: this output is marked `aria-hidden` since the real
   * content already exists in `steps`. Do not put the only copy of any
   * information, or any focusable control, here.
   */
  renderSticky: (activeIndex: number) => ReactNode;
  className?: string;
  stepClassName?: string;
  stickyPaneClassName?: string;
  /** Viewport width (px) below which the stacked fallback replaces the sticky layout. Defaults to 768. */
  disabledBelow?: number;
}

/**
 * Pure step-index calculation, exported for unit testing independent of a
 * real scroll container. Progress is whole-container 0-1; step boundaries
 * are evenly spaced, and the result is always clamped into range so a
 * progress value of exactly 1 (or a floating-point overshoot) still resolves
 * to the last step rather than an out-of-bounds index.
 */
export function computeActiveStepIndex(progress: number, stepCount: number): number {
  if (stepCount <= 0) return 0;
  return Math.min(stepCount - 1, Math.max(0, Math.floor(progress * stepCount)));
}

/**
 * TASK-051 — sticky-scroll foundation. Not final landing content: this is
 * the generic "N steps, one sticky companion panel, active step tracked by
 * scroll position" mechanism that a future task's actual story content
 * builds on.
 *
 * Renders the stacked, non-sticky fallback on the server and on first client
 * render unconditionally (`mounted` starts false), then upgrades to the
 * sticky two-column layout only after mount confirms the visitor is on a
 * wide viewport with no reduced-motion preference. This means server HTML
 * and the first client render are always identical (no hydration mismatch),
 * and any downgrade (mobile, reduced motion) never has to happen — the
 * simple, always-accessible layout is the default, sticky is the opt-up.
 *
 * `activeIndex` state only changes at step boundaries, not on every scroll
 * frame (scroll progress itself is a Framer `MotionValue`, read via
 * `useMotionValueEvent` rather than a subscribed value), so most scroll
 * frames update zero React state.
 */
export function StickyStory({
  steps,
  renderSticky,
  className,
  stepClassName,
  stickyPaneClassName,
  disabledBelow = 768,
}: StickyStoryProps) {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const isBelowBreakpoint = useMediaQuery(`(max-width: ${disabledBelow}px)`);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => setMounted(true), []);

  const stickyEnabled = mounted && !prefersReducedMotion && !isBelowBreakpoint && steps.length > 0;

  const scrollYProgress = useScrollProgress({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    if (!stickyEnabled) return;
    const nextIndex = computeActiveStepIndex(progress, steps.length);
    setActiveIndex((current) => (current === nextIndex ? current : nextIndex));
  });

  // `containerRef` is attached here unconditionally (in both the stacked
  // and sticky branches) rather than only inside the sticky JSX, so
  // `useScrollProgress`'s `useScroll({ target: containerRef })` above always
  // has a hydrated ref by the time it needs one — including on the first
  // render, where `stickyEnabled` is still false. Attaching it only inside
  // a conditional branch would leave the ref unhydrated on every render
  // that takes the other branch, which Framer Motion warns about.
  if (!stickyEnabled) {
    return (
      <div ref={containerRef} className={className}>
        {steps.map((step, index) => (
          <div key={index} className={stepClassName}>
            {step}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("grid grid-cols-2 gap-lg", className)}>
      <div>
        {steps.map((step, index) => (
          <div key={index} className={cn("min-h-screen", stepClassName)}>
            {step}
          </div>
        ))}
      </div>
      <div className={cn("sticky top-0 h-screen", stickyPaneClassName)} aria-hidden="true">
        {renderSticky(activeIndex)}
      </div>
    </div>
  );
}
