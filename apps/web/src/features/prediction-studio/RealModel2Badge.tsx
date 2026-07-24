import { Cpu } from "lucide-react";
import { Badge } from "@repo/ui";

export interface RealModel2BadgeProps {
  className?: string;
}

/**
 * Prediction Studio mode-correction task — Real Model 2.0's pre-result
 * disclosure, replacing `SyntheticScenarioBadge` for this mode (that
 * component and its "simulated team profiles" copy is Real Model 1.0/legacy-
 * synthetic-only now; Real Model 2.0 must never show it). Same visual shell
 * as `SyntheticScenarioBadge` for layout continuity, truthful real-data copy
 * instead. The exact data cutoff/model version aren't known yet at this
 * pre-submission stage — those appear in the result's own provenance detail,
 * same as Real Model 1.0's pattern.
 */
export function RealModel2Badge({ className }: RealModel2BadgeProps) {
  return (
    <div className={className}>
      <div className="flex items-start gap-2xs rounded-md border border-surface-border bg-surface p-2xs">
        <Badge tone="brand" className="flex shrink-0 items-center gap-1">
          <Cpu aria-hidden="true" className="size-3" />
          Real Model 2.0
        </Badge>
        <p className="text-xs text-muted-foreground">
          Predictions use real curated historical VCT match data and the active real trained model. Data is
          current only through the model&apos;s displayed cutoff; the tournament context is an explicit
          assumption, not a scheduled event. Not a guaranteed future outcome.
        </p>
      </div>
    </div>
  );
}
