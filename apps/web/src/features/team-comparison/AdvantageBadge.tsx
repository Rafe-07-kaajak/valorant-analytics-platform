import { Badge, cn } from "@repo/ui";
import type { Advantage, DifferenceTier } from "../../lib/teamComparison";

export interface AdvantageBadgeProps {
  advantage: Advantage;
  tier: DifferenceTier;
  teamAName: string;
  teamBName: string;
  className?: string;
}

const TIER_LABEL: Record<DifferenceTier, string> = {
  none: "Close/Even",
  slight: "Slight edge",
  moderate: "Moderate edge",
  strong: "Strong edge",
};

/**
 * Always pairs color with the actual team name (never a bare colored dot),
 * so Team A/Team B are never distinguished by color alone — the leading
 * team's name is always present in the badge text. "Close/Even" (rather
 * than a bare "Even") deliberately avoids implying more certainty than a
 * modeled, simulated-data gap warrants — see TASK-036's threshold labeling.
 */
export function AdvantageBadge({ advantage, tier, teamAName, teamBName, className }: AdvantageBadgeProps) {
  if (advantage === "even") {
    return (
      <Badge tone="neutral" className={className}>
        Close/Even
      </Badge>
    );
  }

  const leader = advantage === "A" ? teamAName : teamBName;

  return (
    <Badge
      tone="neutral"
      className={cn("gap-2xs", className)}
    >
      <span
        className={cn("inline-block size-2 rounded-full", advantage === "A" ? "bg-team-a" : "bg-team-b")}
        aria-hidden="true"
      />
      {leader} · {TIER_LABEL[tier]}
    </Badge>
  );
}
