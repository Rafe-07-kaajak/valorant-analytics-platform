import { FlaskConical } from "lucide-react";
import { Badge } from "@repo/ui";

export interface SyntheticScenarioBadgeProps {
  /** The authoritative disclosure text (TASK-031's `VCT_PROFILE_DISCLOSURE`), passed down rather than hardcoded here so this stays the single source of truth. */
  disclosure: string;
  className?: string;
}

/**
 * TASK-055 section 18 — the synthetic-data disclosure must be a visible
 * badge, not buried in small footer text. Uses the real `disclosure` prop
 * (validated elsewhere against banned official-data-claim phrases) rather
 * than a second hardcoded string, so the badge and the warning shown after
 * a result always say exactly the same thing.
 */
export function SyntheticScenarioBadge({ disclosure, className }: SyntheticScenarioBadgeProps) {
  return (
    <div className={className}>
      <div className="flex items-start gap-2xs rounded-md border border-surface-border bg-surface p-2xs">
        <Badge tone="info" className="flex shrink-0 items-center gap-1">
          <FlaskConical aria-hidden="true" className="size-3" />
          Synthetic Scenario
        </Badge>
        <p className="text-xs text-muted-foreground">{disclosure}</p>
      </div>
    </div>
  );
}
