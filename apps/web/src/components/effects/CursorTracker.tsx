"use client";

import { useEffect } from "react";
import { cursorPosition } from "../../lib/cursorPosition";

const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

/**
 * TASK-034 — the single global pointer-tracking listener for the whole app.
 * Renders nothing; every cursor-reactive effect (global spotlight, tactical
 * grid parallax, card-local glow, the particle field) reads from what this
 * writes instead of registering its own listener — see
 * docs/22-interaction-system.md for the full list of consumers.
 *
 * Skips attaching anything at all on coarse/no-hover pointers (touch), so
 * there the listener count is zero rather than one-but-inert.
 *
 * Writes go to two places:
 *  - the plain `cursorPosition` object, updated synchronously on every event
 *    (a couple of number writes costs nothing to skip throttling).
 *  - `--cursor-x` / `--cursor-y` / `--cursor-x-normalized` /
 *    `--cursor-y-normalized` on `<html>`, rAF-throttled, since writing a CSS
 *    custom property triggers a style recalculation and that cost is worth
 *    bounding to once per frame.
 */
export function CursorTracker() {
  useEffect(() => {
    if (!window.matchMedia(FINE_POINTER_QUERY).matches) return;

    const root = document.documentElement;
    let rafId = 0;

    const flushCssVars = () => {
      rafId = 0;
      const width = window.innerWidth || 1;
      const height = window.innerHeight || 1;
      root.style.setProperty("--cursor-x", `${cursorPosition.x}px`);
      root.style.setProperty("--cursor-y", `${cursorPosition.y}px`);
      root.style.setProperty("--cursor-x-normalized", `${cursorPosition.x / width}`);
      root.style.setProperty("--cursor-y-normalized", `${cursorPosition.y / height}`);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      cursorPosition.x = event.clientX;
      cursorPosition.y = event.clientY;
      cursorPosition.active = true;
      root.dataset.cursorActive = "true";
      if (!rafId) rafId = requestAnimationFrame(flushCssVars);
    };

    const handlePointerLeave = () => {
      cursorPosition.active = false;
      root.dataset.cursorActive = "false";
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    root.addEventListener("mouseleave", handlePointerLeave);
    window.addEventListener("blur", handlePointerLeave);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      root.removeEventListener("mouseleave", handlePointerLeave);
      window.removeEventListener("blur", handlePointerLeave);
      if (rafId) cancelAnimationFrame(rafId);
      delete root.dataset.cursorActive;
      cursorPosition.active = false;
    };
  }, []);

  return null;
}
