import { FeatureContributionChart } from "./FeatureContributionChart";
import type { BreakdownController } from "./useBreakdownState";
import type { ContributionRow } from "../../../lib/predictionBreakdown";

export interface ContributionsTabProps {
  rows: ContributionRow[];
  teamAName: string;
  teamBName: string;
  breakdown: BreakdownController;
}

export function ContributionsTab({ rows, teamAName, teamBName, breakdown }: ContributionsTabProps) {
  return (
    <div className="flex flex-col gap-md">
      <p className="text-sm text-muted-foreground">
        Each bar is one tracked Team DNA dimension&apos;s share of the total modeled gap between these
        teams — not a share of the win probability itself. Select a bar to see it highlighted throughout
        this breakdown.
      </p>
      <FeatureContributionChart rows={rows} teamAName={teamAName} teamBName={teamBName} breakdown={breakdown} />
    </div>
  );
}
