"use client";

import { useMediaQuery } from "./useMediaQuery";

export interface PointerCapability {
  /** True on a mouse/trackpad-class pointer; false on touch. */
  isFinePointer: boolean;
  /** True when the primary input can hover without a persistent tap. */
  hasHover: boolean;
  /** Convenience negation of (isFinePointer && hasHover), for touch-gated branches. */
  isCoarsePointer: boolean;
}

/**
 * TASK-051 — capability check for the mobile/pointer policy every
 * pointer-follow or hover-only primitive must honor: fine-pointer effects
 * only on fine pointers, hover effects only when hover is supported. Mirrors
 * the `(pointer: coarse), (hover: none)` gate already hand-written in
 * `apps/web/src/styles/cursor-effects.css`, exposed as a hook so JavaScript
 * decisions (skip mounting a pointer listener at all, not just hide the
 * result with CSS) can branch on the same rule.
 */
export function usePointerCapability(): PointerCapability {
  const isFinePointer = useMediaQuery("(pointer: fine)");
  const hasHover = useMediaQuery("(hover: hover)");

  return {
    isFinePointer,
    hasHover,
    isCoarsePointer: !(isFinePointer && hasHover),
  };
}
