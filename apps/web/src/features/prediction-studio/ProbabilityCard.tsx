import type { Team, TeamPredictionOutcome } from "@repo/shared";
import { SplitBar } from "@repo/ui";

export interface ProbabilityCardProps {
  teamA: Team;
  teamB: Team;
  outcomes: [TeamPredictionOutcome, TeamPredictionOutcome];
}

export function ProbabilityCard({ teamA, teamB, outcomes }: ProbabilityCardProps) {
  const outcomeFor = (teamId: string) => outcomes.find((outcome) => outcome.teamId === teamId)!;

  return (
    <div className="flex flex-col gap-2xs">
      <span className="text-sm font-medium text-foreground">Win Probability</span>
      <SplitBar
        segments={[
          {
            id: teamA.id,
            label: teamA.name,
            value: outcomeFor(teamA.id).winProbability,
            color: "var(--team-a)",
          },
          {
            id: teamB.id,
            label: teamB.name,
            value: outcomeFor(teamB.id).winProbability,
            color: "var(--team-b)",
          },
        ]}
      />
    </div>
  );
}
