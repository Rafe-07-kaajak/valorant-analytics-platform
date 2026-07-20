"use client";

import { motion } from "framer-motion";
import { cn } from "../../lib/cn";
import { EASE_EMPHASIZED, REVEAL_DISTANCE } from "../../lib/motion";

export interface TextLineRevealProps {
  /** The full text to reveal. Plain string only, not JSX, so it can also become a single accessible name. */
  text: string;
  className?: string;
  wordClassName?: string;
  /** Seconds between each word's reveal start. Defaults to 0.04. */
  stagger?: number;
  /** Seconds before the first word starts. Defaults to 0. */
  delay?: number;
  duration?: number;
  once?: boolean;
  as?: "span" | "p" | "h1" | "h2" | "h3" | "h4";
}

/**
 * TASK-051 — word-by-word reveal. Word-level, not true rendered-line-level:
 * grouping spans by their actual wrapped line requires a layout measurement
 * pass (ResizeObserver/getBoundingClientRect per word) that changes at every
 * breakpoint and is brittle to font loading timing; word-level reveal reads
 * the same visually and needs none of that. See docs/39, "known
 * limitations".
 *
 * Accessibility: the outer element carries `aria-label={text}` (the one
 * accessible copy of the text, read exactly once). A `<span>`/`<p>` has no
 * default ARIA role that permits naming from `aria-label` (axe-core's
 * `aria-prohibited-attr` rule catches this), so those two `as` values also
 * get `role="group"` — a role change that's a no-op for `<h1>`-`<h4>`,
 * whose implicit `heading` role already supports `aria-label` without
 * stripping the heading semantics a screen reader needs to navigate by, so
 * they're deliberately left without an explicit role. The animated word
 * spans live in an `aria-hidden` inner wrapper, decorative only, never read
 * by a screen reader, so nothing is duplicated. Under reduced motion this still
 * renders the same DOM; Framer's app-wide `MotionConfig reducedMotion="user"`
 * (see `MotionProvider`) makes the transform apply instantly, so the words
 * are effectively already in place rather than requiring a second code path.
 * SSR-safe: no client-only hook drives which branch renders, so server and
 * first client render always match.
 */
export function TextLineReveal({
  text,
  className,
  wordClassName,
  stagger = 0.04,
  delay = 0,
  duration = 0.5,
  once = true,
  as = "span",
}: TextLineRevealProps) {
  const words = text.split(" ");
  const Wrapper = as;
  const role = as === "span" || as === "p" ? "group" : undefined;

  return (
    <Wrapper className={className} aria-label={text} role={role}>
      <motion.span
        aria-hidden="true"
        initial="hidden"
        whileInView="visible"
        viewport={{ once, margin: "-40px" }}
        variants={{ visible: { transition: { staggerChildren: stagger, delayChildren: delay } } }}
      >
        {words.map((word, index) => (
          <motion.span
            key={index}
            className={cn("inline-block", wordClassName)}
            variants={{ hidden: { opacity: 0, y: REVEAL_DISTANCE * 0.5 }, visible: { opacity: 1, y: 0 } }}
            transition={{ duration, ease: EASE_EMPHASIZED }}
          >
            {word}
          </motion.span>
        )).flatMap((span, index) => (index === 0 ? [span] : [" ", span]))}
      </motion.span>
    </Wrapper>
  );
}
