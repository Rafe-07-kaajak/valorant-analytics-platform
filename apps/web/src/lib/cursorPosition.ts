/**
 * TASK-034 shared cursor-position store. `CursorTracker` is the single
 * global pointermove listener for the app; it writes here on every event.
 * Any other JS consumer (e.g. the canvas-based `InteractiveParticleField`)
 * reads this directly instead of registering its own window-level listener.
 * A plain mutable object, not React state — reads/writes are just property
 * access, no rerenders, no subscription machinery.
 */
export interface CursorPosition {
  /** Viewport-relative clientX, in px. */
  x: number;
  /** Viewport-relative clientY, in px. */
  y: number;
  /** False once the pointer has left the viewport or window loses focus. */
  active: boolean;
}

export const cursorPosition: CursorPosition = { x: -1000, y: -1000, active: false };
