import { Badge, cn } from "@repo/ui";

export interface ComparisonCoreProps {
  ready: boolean;
  className?: string;
}

/**
 * TASK-057 — the selector console's central node. Replaces the plain "VS"
 * text divider with a compact panel that carries the team-A/team-B split
 * identity into the middle of the console and states whether a comparison
 * is currently ready, using only state TeamComparisonClient already
 * computes (both teams selected or not) — no new fields, no invented
 * controls. "VS" itself stays decorative (aria-hidden, matching the
 * original divider); the readiness line is the only new accessible text,
 * and its wording is distinct from ComparisonEmptyState's copy so screen
 * reader users never hear the same status announced twice verbatim.
 */
export function ComparisonCore({ ready, className }: ComparisonCoreProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2xs text-center lg:h-full", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "flex size-12 items-center justify-center rounded-full border border-surface-border text-sm font-bold uppercase tracking-wide",
          "bg-[image:linear-gradient(135deg,color-mix(in_oklab,var(--team-a)_22%,transparent),color-mix(in_oklab,var(--team-b)_22%,transparent))]",
          "shadow-[0_0_20px_-6px_color-mix(in_oklab,var(--team-a)_60%,transparent),0_0_20px_-6px_color-mix(in_oklab,var(--team-b)_60%,transparent)]",
        )}
      >
        VS
      </span>
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Modeled profile faceoff
      </span>
      <Badge tone={ready ? "success" : "neutralStatus"}>{ready ? "Ready to compare" : "Awaiting both teams"}</Badge>
    </div>
  );
}
