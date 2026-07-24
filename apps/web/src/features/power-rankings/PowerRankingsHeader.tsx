import { Trophy } from "lucide-react";

/**
 * Modeled on Prediction Studio's plain-text header (no background image),
 * not the photo-header pattern Comparison Lab/Map Explorer use — there is no
 * existing `power-rankings-header*.png` asset, and none may be created for
 * this task, so a bespoke text-only header is the correct precedent to
 * follow here rather than a photo header with a placeholder image.
 */
export function PowerRankingsHeader() {
  return (
    <div className="flex flex-col gap-sm">
      <div className="flex items-center gap-2xs">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-surface-border bg-badge-brand-bg text-badge-brand-text">
          <Trophy className="size-4" aria-hidden="true" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Competitive standings
        </span>
      </div>

      <div>
        <h1 className="text-lg font-semibold text-foreground">Power Rankings</h1>
        <p className="text-sm text-muted-foreground">
          Track team strength through form, map depth, consistency, and modeled performance signals.
        </p>
      </div>
    </div>
  );
}
