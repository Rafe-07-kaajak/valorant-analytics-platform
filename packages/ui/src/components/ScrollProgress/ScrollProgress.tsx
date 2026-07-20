"use client";

import { motion, useMotionValueEvent } from "framer-motion";
import { useRef, type RefObject } from "react";
import { cn } from "../../lib/cn";
import { useScrollProgress } from "../../hooks/useScrollProgress";

export interface ScrollProgressProps {
  /** Omit for whole-page progress; pass a ref for section-local progress. */
  target?: RefObject<HTMLElement | null>;
  className?: string;
  barClassName?: string;
  /**
   * What this bar's progress means, e.g. "Article reading progress". Adds
   * `role="progressbar"` and a live `aria-valuenow`. Omit for a purely
   * decorative bar (`aria-hidden`) — per the accessibility policy, only add
   * the label when the value genuinely communicates something to the user
   * (e.g. not for a bar that's purely a visual accent).
   */
  label?: string;
}

/**
 * TASK-051 — not mounted anywhere by this task (see docs/39). Binds
 * `scaleX` directly to the `MotionValue` from `useScrollProgress`, a
 * transform rather than an animated `width`, and with no interpolation of
 * its own: the bar always reflects the real scroll position 1:1, which is
 * also why "reduced motion" needs no special case here — there is no tween
 * to disable, only a direct read of where the page actually is.
 *
 * When `label` is set, `aria-valuenow` is written imperatively via a ref on
 * each `useMotionValueEvent` tick (not React state), so a fast-scrolling
 * page never re-renders this component — consistent with the "no full-page
 * React re-render on scroll" guardrail used throughout this module.
 */
export function ScrollProgress({ target, className, barClassName, label }: ScrollProgressProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollYProgress = useScrollProgress({ target });

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    if (!label) return;
    containerRef.current?.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
  });

  return (
    <div
      ref={containerRef}
      className={cn("h-1 w-full overflow-hidden", className)}
      role={label ? "progressbar" : undefined}
      aria-label={label}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-hidden={label ? undefined : true}
    >
      <motion.div
        className={cn("h-full w-full origin-left bg-brand-500", barClassName)}
        style={{ scaleX: scrollYProgress }}
      />
    </div>
  );
}
