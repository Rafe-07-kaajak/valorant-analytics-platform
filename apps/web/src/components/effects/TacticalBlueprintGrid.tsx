import { cn } from "@repo/ui";

/**
 * Effect 29 — a faint tactical blueprint line-grid, echoing the map-callout
 * HUDs in the asset library. Pure CSS (layered linear-gradients); static, so
 * there's no motion to gate behind prefers-reduced-motion.
 */
export function TacticalBlueprintGrid({ className }: { className?: string }) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden opacity-[0.08]", className)}
      aria-hidden="true"
      style={{
        backgroundImage:
          "linear-gradient(to right, var(--surface-border) 1px, transparent 1px), linear-gradient(to bottom, var(--surface-border) 1px, transparent 1px), linear-gradient(to right, var(--team-a) 1px, transparent 1px), linear-gradient(to bottom, var(--team-a) 1px, transparent 1px)",
        backgroundSize: "24px 24px, 24px 24px, 120px 120px, 120px 120px",
      }}
    />
  );
}
