import { Card } from "@repo/ui";
import { AdvantageBadge } from "./AdvantageBadge";
import type { ComparisonFactor } from "../../lib/teamComparison";

export interface FactorsTabProps {
  teamAName: string;
  teamBName: string;
  factors: ComparisonFactor[];
}

/** Sorted most-significant-first by `deriveFactors` — displayed in that order. */
export function FactorsTab({ teamAName, teamBName, factors }: FactorsTabProps) {
  return (
    <Card className="flex flex-col gap-md">
      <ul className="flex flex-col gap-sm">
        {factors.map((factor) => (
          <li
            key={factor.id}
            className="flex flex-col gap-2xs rounded-md p-2xs transition-colors duration-(--duration-fast) ease-(--ease-standard) hover:bg-surface-border/30"
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
    </Card>
  );
}
