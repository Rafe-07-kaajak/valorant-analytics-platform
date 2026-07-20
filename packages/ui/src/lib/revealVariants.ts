import type { Variants } from "framer-motion";

export type RevealDirection = "up" | "down" | "left" | "right";

/**
 * TASK-051 — shared opacity+transform variant builder behind `ScrollReveal`
 * and `StaggerGroup`'s `StaggerItem`, so the "which edge does this travel
 * in from" mapping exists in exactly one place. Transform + opacity only,
 * per the performance guardrail against animating layout properties.
 */
export function buildRevealVariants(distance: number, direction: RevealDirection): Variants {
  const offset =
    direction === "up"
      ? { y: distance }
      : direction === "down"
        ? { y: -distance }
        : direction === "left"
          ? { x: distance }
          : { x: -distance };

  return {
    hidden: { opacity: 0, ...offset },
    visible: { opacity: 1, x: 0, y: 0 },
  };
}
