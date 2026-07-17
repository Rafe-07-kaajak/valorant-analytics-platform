/**
 * TASK-034 — the global cursor spotlight visual. Pure CSS: its position and
 * visibility come entirely from the `--cursor-x`/`--cursor-y` custom
 * properties and the `data-cursor-active` flag that `CursorTracker` writes
 * onto `<html>`, so this component itself needs no client-side JS and never
 * rerenders. See `.cursor-spotlight` in styles/cursor-effects.css.
 */
export function CursorSpotlight() {
  return <div className="cursor-spotlight" aria-hidden="true" />;
}
