"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@repo/ui";
import { usePointerGlow } from "../../hooks/usePointerGlow";

export interface CardSpotlightProps {
  children: ReactNode;
  className?: string;
  /**
   * CSS color for the glow tint, e.g. `"var(--team-a)"` or a `color-mix()`
   * string, matching `TeamCard`'s existing `--spotlight-color` convention.
   * Omit to use `.pointer-glow`'s default brand tint.
   */
  spotlightColor?: string;
}

/**
 * TASK-051 — consolidates the card-local pointer-glow pattern TASK-034
 * already hand-wrote at each of `RegionCard`, `TeamCard`,
 * `SelectedTeamSummary`, and `FinalCta` (the `usePointerGlow` hook plus the
 * `.pointer-glow` class plus an optional `--spotlight-color` style) into one
 * reusable wrapper, per the "existing motion consolidation" requirement.
 *
 * Deliberately not applied to those four existing call sites: doing so
 * would touch production page markup for a purely internal refactor with no
 * visible behavior change, which this task's "no production page redesign"
 * and "avoid changing every page merely to adopt new components" rules both
 * rule out. It exists so a future task (or this task's showcase) can reach
 * for one component instead of re-deriving the hook + class + style
 * combination again. See docs/22-interaction-system.md for the full
 * card-local spotlight behavior (touch/reduced-motion handling lives in
 * `.pointer-glow`'s CSS, unchanged by this task) and docs/39 for why this
 * lives in `apps/web` rather than `packages/ui`: `.pointer-glow` and
 * `--spotlight-color` are app-specific tokens (`cursor-effects.css`,
 * `--team-a`/`--team-b`), not part of the portable design-system package.
 * Always a `<div>`: every existing consumer of this pattern (the four
 * components above) wraps a `<div>`, and a polymorphic `as` prop widened the
 * pointer-handler types to an unhelpful union for no real call site.
 */
export function CardSpotlight({ children, className, spotlightColor }: CardSpotlightProps) {
  const pointerGlow = usePointerGlow<HTMLDivElement>();

  return (
    <div
      className={cn("pointer-glow", className)}
      style={spotlightColor ? ({ "--spotlight-color": spotlightColor } as CSSProperties) : undefined}
      onPointerEnter={pointerGlow.onPointerEnter}
      onPointerMove={pointerGlow.onPointerMove}
      onPointerLeave={pointerGlow.onPointerLeave}
    >
      {children}
    </div>
  );
}
