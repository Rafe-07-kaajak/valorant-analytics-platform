"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { EASE_EMPHASIZED } from "../../lib/motion";
import { type RevealDirection } from "../../lib/revealVariants";

export interface ImageMaskRevealProps {
  /** The image content, e.g. a next/image `<Image>`. Always mounted and never hidden — decode is never blocked by the reveal state. */
  children: ReactNode;
  className?: string;
  /** Class for the covering panel. Defaults to a plain surface color; override to match the section's background. */
  maskClassName?: string;
  /** Which edge the mask slides off toward. Defaults to "left" (mask exits left, image reveals left-to-right). */
  direction?: RevealDirection;
  duration?: number;
  delay?: number;
  once?: boolean;
}

function getExitTransform(direction: RevealDirection): { x?: string; y?: string } {
  switch (direction) {
    case "up":
      return { y: "-100%" };
    case "down":
      return { y: "100%" };
    case "left":
      return { x: "-100%" };
    case "right":
      return { x: "100%" };
  }
}

/**
 * TASK-051 — image reveal via a covering panel that translates away, not a
 * `clip-path` animation: a `transform`-only exit stays on the compositor in
 * every browser, where an animated `clip-path` can force paint depending on
 * engine/version. The image itself is always mounted at full opacity behind
 * the mask, so nothing here delays decode — the mask is a purely visual
 * overlay, `aria-hidden` and `pointer-events-none`, never gating the image's
 * presence in the DOM or accessibility tree.
 *
 * Reduced motion: the mask's exit is a transform, so it inherits the same
 * instant-apply behavior from the app-wide `MotionConfig reducedMotion="user"`
 * as every other primitive here — no separate branch needed, the final
 * (fully revealed) state is simply reached without a visible slide.
 */
export function ImageMaskReveal({
  children,
  className,
  maskClassName,
  direction = "left",
  duration = 0.7,
  delay = 0,
  once = true,
}: ImageMaskRevealProps) {
  const exit = getExitTransform(direction);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {children}
      <motion.div
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-0 bg-surface", maskClassName)}
        initial={{ x: "0%", y: "0%" }}
        whileInView={exit}
        viewport={{ once, margin: "-40px" }}
        transition={{ duration, delay, ease: EASE_EMPHASIZED }}
      />
    </div>
  );
}
