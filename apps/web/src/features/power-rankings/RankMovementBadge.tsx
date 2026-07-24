import { Badge } from "@repo/ui";

export interface RankMovementBadgeProps {
  className?: string;
}

/**
 * No historical Power Rankings snapshot exists yet, so every team reads
 * "Baseline" rather than a fabricated +/- delta. Kept as its own component so
 * the one place this rule is enforced is a single file — wiring in a real
 * snapshot comparator later only means changing this component, not every
 * card/row that renders movement.
 */
export function RankMovementBadge({ className }: RankMovementBadgeProps) {
  return (
    <Badge tone="neutralStatus" className={className} aria-label="Baseline: no prior ranking snapshot exists yet">
      Baseline
    </Badge>
  );
}
