import { cn } from "@repo/ui";
import { AdvantageBadge } from "./AdvantageBadge";
import type { ComparisonFactor } from "../../lib/teamComparison";

export interface FactorsTabProps {
  teamAName: string;
  teamBName: string;
  factors: ComparisonFactor[];
}

/** Sorted most-significant-first by `deriveFactors` — displayed in that order, which already carries the visual hierarchy (top of the list is the largest modeled difference). */
export function FactorsTab({ teamAName, teamBName, factors }: FactorsTabProps) {
  return (
    <ul className="flex flex-col gap-sm">
      {factors.map((factor) => (
        <li
          key={factor.id}
          className={cn(
            "flex flex-col gap-2xs rounded-md border border-surface-border bg-surface p-sm transition-colors duration-(--duration-fast) ease-(--ease-standard) hover:bg-surface-border/30",
            factor.tier === "none" && "opacity-70",
            factor.advantage === "A" && "border-l-2 border-l-team-a",
            factor.advantage === "B" && "border-l-2 border-l-team-b",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2xs">
            <span className="text-sm font-medium text-foreground">{factor.title}</span>
            <AdvantageBadge
              advantage={factor.advantage}
              tier={factor.tier}
              teamAName={teamAName}
              teamBName={teamBName}
            />
          </div>
          <p className="text-sm text-muted-foreground">{factor.description}</p>
        </li>
      ))}
    </ul>
  );
}
