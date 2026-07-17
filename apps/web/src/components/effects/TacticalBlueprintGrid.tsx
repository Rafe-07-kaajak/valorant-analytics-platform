import { cn } from "@repo/ui";

export interface TacticalBlueprintGridProps {
  className?: string;
  /**
   * TASK-034 — enables a very small cursor-driven parallax shift (reads the
   * global `--cursor-x-normalized`/`--cursor-y-normalized` written by
   * `CursorTracker`) plus a soft proximity glow near the pointer. The glow
   * needs a hovered ancestor carrying the `tactical-grid-glow-host` class
   * and `usePointerGlow` handlers (see `MatchDnaSection`) — parallax alone
   * works with no other wiring. Both fall back to fully static under
   * reduced motion or a coarse/no-hover pointer.
   */
  interactive?: boolean;
}

/**
 * Effect 29 — a faint tactical blueprint line-grid, echoing the map-callout
 * HUDs in the asset library. Pure CSS (layered linear-gradients); the base
 * pattern is static, so there's no motion to gate behind
 * prefers-reduced-motion — only the opt-in `interactive` parallax/glow is.
 */
export function TacticalBlueprintGrid({ className, interactive = false }: TacticalBlueprintGridProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden opacity-[0.08]",
        interactive && "tactical-grid-parallax",
        className,
      )}
      aria-hidden="true"
      style={{
        backgroundImage:
          "linear-gradient(to right, var(--surface-border) 1px, transparent 1px), linear-gradient(to bottom, var(--surface-border) 1px, transparent 1px), linear-gradient(to right, var(--team-a) 1px, transparent 1px), linear-gradient(to bottom, var(--team-a) 1px, transparent 1px)",
        backgroundSize: "24px 24px, 24px 24px, 120px 120px, 120px 120px",
      }}
    >
      {interactive ? <div className="tactical-grid-glow" /> : null}
    </div>
  );
}
