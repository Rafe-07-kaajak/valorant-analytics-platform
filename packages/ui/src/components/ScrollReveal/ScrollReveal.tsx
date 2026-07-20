"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { EASE_EMPHASIZED, REVEAL_DISTANCE } from "../../lib/motion";
import { buildRevealVariants, type RevealDirection } from "../../lib/revealVariants";

export type ScrollRevealDirection = RevealDirection;

export interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  /** Seconds to wait before the reveal starts, e.g. for staggering a hand-written list. */
  delay?: number;
  /** Seconds the reveal transition takes. Defaults to 0.6, the pre-existing value. */
  duration?: number;
  /** Pixels the content travels from. Defaults to --reveal-distance (24px). */
  distance?: number;
  /** Which edge the content travels in from. Defaults to "up" (the pre-existing y:24 behavior). */
  direction?: ScrollRevealDirection;
  /** Replay on every viewport entry/exit instead of once. Defaults to true, the pre-existing behavior. */
  once?: boolean;
  /** Fraction of the element that must be visible to trigger. Framer's viewport default ("some") if omitted. */
  amount?: number | "some" | "all";
  /**
   * Skip the reveal entirely and render children in their final state with no
   * motion wrapper — for content that would otherwise flash hidden-then-visible
   * on hydration (e.g. already above the fold) or that a caller has decided
   * should never animate.
   */
  disabled?: boolean;
  as?: "div" | "section";
}

/**
 * TASK-033 baseline, extended in TASK-051 with duration/distance/direction/
 * amount/disabled. Every new prop defaults to the pre-existing value, so
 * every current call site (landing page sections, none of which pass the
 * new props) renders byte-for-byte identical animation behavior.
 *
 * Reduced motion is handled for free by the app-wide
 * `MotionConfig reducedMotion="user"` (`MotionProvider`, mounted in
 * `app/layout.tsx`): Framer Motion forces this component's x/y transform to
 * apply instantly while still allowing the opacity fade, so content never
 * stays invisible and no separate reduced-motion branch is needed here. See
 * docs/39 for the full policy and why this differs from primitives that
 * don't use `motion.*` (those check `usePrefersReducedMotion()` directly).
 */
export function ScrollReveal({
  children,
  className,
  delay = 0,
  duration = 0.6,
  distance = REVEAL_DISTANCE,
  direction = "up",
  once = true,
  amount,
  disabled = false,
  as = "div",
}: ScrollRevealProps) {
  if (disabled) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  const MotionTag = as === "section" ? motion.section : motion.div;

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-80px", amount }}
      variants={buildRevealVariants(distance, direction)}
      transition={{ duration, delay, ease: EASE_EMPHASIZED }}
    >
      {children}
    </MotionTag>
  );
}
