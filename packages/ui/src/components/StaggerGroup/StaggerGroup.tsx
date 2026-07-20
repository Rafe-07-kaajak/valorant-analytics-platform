"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { EASE_EMPHASIZED, REVEAL_DISTANCE } from "../../lib/motion";
import { buildRevealVariants, type RevealDirection } from "../../lib/revealVariants";

export interface StaggerGroupProps {
  children: ReactNode;
  className?: string;
  /** Seconds between each child's reveal start. Defaults to 0.08. */
  stagger?: number;
  /** Seconds before the first child starts. Defaults to 0. */
  delay?: number;
  once?: boolean;
  amount?: number | "some" | "all";
  as?: "div" | "section" | "ul";
}

export interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  distance?: number;
  direction?: RevealDirection;
  duration?: number;
  as?: "div" | "li";
}

/**
 * TASK-051 — deterministic list/grid reveal. `StaggerGroup` sets Framer's
 * `staggerChildren`/`delayChildren` on its own `variants` and triggers once
 * via `whileInView`; every `StaggerItem` inside inherits the "hidden" →
 * "visible" animation state from this ancestor through Framer's variant
 * propagation (React context under the hood) — no `React.Children.map`/
 * `cloneElement`, so children can be any JSX, not just direct `StaggerItem`
 * descendants (a `StaggerItem` can be nested inside a wrapper element and
 * still animate, as long as no element in between is itself a `motion.*`
 * component with its own `initial`/`animate` that would break propagation).
 *
 * Delay order follows JSX child order exactly (Framer applies
 * `staggerChildren` by render order of the animating descendants it finds) —
 * deterministic, no `Math.random()` anywhere in this module.
 *
 * Nesting: a `StaggerGroup` nested inside a `StaggerItem` does NOT cascade
 * automatically, because the inner group's own `whileInView`/`variants` take
 * over and re-trigger its own IntersectionObserver entry instead of
 * inheriting the outer "visible" state. For a single cascading reveal, use
 * one `StaggerGroup` with `StaggerItem` children only; for two independent
 * reveal moments (e.g. a hero stagger, then a separate grid stagger further
 * down), use two separate `StaggerGroup`s — each gets its own trigger, which
 * is usually what "nested" scroll content actually wants.
 */
export function StaggerGroup({
  children,
  className,
  stagger = 0.08,
  delay = 0,
  once = true,
  amount,
  as = "div",
}: StaggerGroupProps) {
  const MotionTag = as === "section" ? motion.section : as === "ul" ? motion.ul : motion.div;

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-80px", amount }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
    >
      {children}
    </MotionTag>
  );
}

export function StaggerItem({
  children,
  className,
  distance = REVEAL_DISTANCE,
  direction = "up",
  duration = 0.5,
  as = "div",
}: StaggerItemProps) {
  const MotionTag = as === "li" ? motion.li : motion.div;

  return (
    <MotionTag
      className={className}
      variants={buildRevealVariants(distance, direction)}
      transition={{ duration, ease: EASE_EMPHASIZED }}
    >
      {children}
    </MotionTag>
  );
}
