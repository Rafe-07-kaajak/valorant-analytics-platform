import { cn } from "./cn";

/**
 * TASK-033 shared interaction primitives. Compose these into component
 * class lists via `cn()` instead of hand-rolling hover/focus/transition
 * strings per component — durations, easing, and movement limits are
 * defined once in apps/web/src/styles/tokens.css.
 */
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";

/** Level 3 — nav, footer, and plain inline links: color only, no lift. */
export const linkInteraction = cn(
  "transition-colors duration-(--duration-fast) ease-(--ease-standard)",
  focusRing,
);

/** Shared icon-button treatment (dialog close buttons, menu toggles). */
export const iconButtonInteraction = cn(
  "transition-colors duration-(--duration-fast) ease-(--ease-standard)",
  "motion-safe:active:scale-(--scale-press)",
  focusRing,
);

/**
 * Framer Motion's `transition.ease` prop takes a raw cubic-bezier array
 * rather than a CSS custom property — kept as a single constant so it stays
 * in sync with --ease-emphasized in tokens.css instead of being copy-pasted
 * per component.
 */
export const EASE_EMPHASIZED = [0.16, 1, 0.3, 1] as const;

/**
 * TASK-051 — mirrors of the remaining tokens.css motion primitives that
 * Framer Motion consumers need as raw values (a `transition.ease`/`duration`
 * prop can't read a CSS custom property). Kept alongside EASE_EMPHASIZED so
 * every motion-library constant lives in one place instead of being
 * redeclared per component.
 */
export const EASE_EXIT = [0.7, 0, 0.84, 0] as const;
export const DURATION_SLOW = 0.48;
export const REVEAL_DISTANCE = 24;
