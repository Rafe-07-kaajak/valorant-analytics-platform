"use client";

import { motion, useTransform } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { useScrollProgress } from "../../hooks/useScrollProgress";

export interface ParallaxLayerProps {
  children: ReactNode;
  className?: string;
  /** Direction and magnitude of the effect. Negative reverses direction. Defaults to 0.2. */
  speed?: number;
  axis?: "x" | "y";
  /** Keep the output bounded to its travel range even if scroll overshoots (elastic/rubber-band scroll). Defaults to true. */
  clamp?: boolean;
  /** Viewport width (px) below which the effect is fully disabled. Defaults to 768 (mobile). */
  disabledBelow?: number;
}

const BASE_TRAVEL_PX = 64;

/**
 * Pure travel-range calculation, exported so the "disabled below breakpoint"
 * and "disabled under reduced motion" behavior is unit-testable without
 * rendering a real scroll container (jsdom can't produce real scroll
 * measurements). `disabled` collapses the range to [0, 0] rather than
 * skipping the transform entirely, so the component always has exactly one
 * code path.
 */
export function computeParallaxRange(speed: number, disabled: boolean): [number, number] {
  if (disabled) return [0, 0];
  const travel = BASE_TRAVEL_PX * speed;
  return [-travel, travel];
}

/**
 * TASK-051 — bounded, transform-only parallax. Reads scroll progress from
 * `useScrollProgress` (Framer's `useScroll` under the hood), which shares
 * one passive `scroll` listener per container across every mounted
 * `ParallaxLayer` (verified against `framer-motion`'s `scrollInfo`, which
 * keys its listener in a `WeakMap` per container) — so N layers on a page
 * never register N document scroll listeners. The offset is a `motion.div`
 * `style.y`/`style.x` write (a `MotionValue`, not React state), so scrolling
 * never triggers a React re-render here.
 *
 * Disabled outright (offset frozen at 0, still a bounded/no-op transform)
 * under reduced motion or below `disabledBelow`, satisfying "mobile lighter
 * than desktop" and "no parallax under reduced motion" as the same code
 * path rather than a second implementation.
 */
export function ParallaxLayer({
  children,
  className,
  speed = 0.2,
  axis = "y",
  clamp = true,
  disabledBelow = 768,
}: ParallaxLayerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const isBelowBreakpoint = useMediaQuery(`(max-width: ${disabledBelow}px)`);
  const scrollYProgress = useScrollProgress({ target: ref });

  const disabled = prefersReducedMotion || isBelowBreakpoint;
  const offset = useTransform(scrollYProgress, [0, 1], computeParallaxRange(speed, disabled), { clamp });

  const style = axis === "y" ? { y: offset } : { x: offset };

  return (
    <motion.div ref={ref} className={className} style={style}>
      {children}
    </motion.div>
  );
}
