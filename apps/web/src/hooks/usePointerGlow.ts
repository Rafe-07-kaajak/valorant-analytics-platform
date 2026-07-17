"use client";

import { useCallback, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/**
 * TASK-034 reusable card-local pointer glow. Tracks the pointer position
 * relative to the hovered element via direct DOM writes (no React state, no
 * rerenders) — the CSS custom properties it sets are consumed by the
 * `.pointer-glow` / `.tactical-grid-glow` classes in styles/cursor-effects.css,
 * whose `:hover`/`:focus-within` rules handle the fade in/out entirely in CSS.
 *
 * The element's bounding rect is read once on pointer-enter and reused for
 * every subsequent pointer-move while hovered, rather than calling
 * `getBoundingClientRect()` on every move — the one layout read only happens
 * while that specific element is actually hovered.
 *
 * Ignores touch input; coarse pointers get no `:hover` to trigger this from
 * in the first place (see the `(pointer: coarse), (hover: none)` guard in
 * cursor-effects.css), but the `pointerType` check keeps that explicit here
 * too rather than relying solely on CSS.
 */
export function usePointerGlow<T extends HTMLElement>() {
  const rectRef = useRef<DOMRect | null>(null);

  const onPointerEnter = useCallback((event: ReactPointerEvent<T>) => {
    if (event.pointerType === "touch") return;
    rectRef.current = event.currentTarget.getBoundingClientRect();
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<T>) => {
    if (event.pointerType === "touch") return;
    const rect = rectRef.current;
    if (!rect) return;
    const target = event.currentTarget;
    target.style.setProperty("--spotlight-x", `${event.clientX - rect.left}px`);
    target.style.setProperty("--spotlight-y", `${event.clientY - rect.top}px`);
  }, []);

  const onPointerLeave = useCallback(() => {
    rectRef.current = null;
  }, []);

  return { onPointerEnter, onPointerMove, onPointerLeave };
}
