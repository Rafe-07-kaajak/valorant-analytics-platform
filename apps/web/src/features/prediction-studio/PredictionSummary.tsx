import type { PredictionResult, Team } from "@repo/shared";
import { Card, Meter } from "@repo/ui";
import { ResultHeader } from "./ResultHeader";
import { ProbabilityCard } from "./ProbabilityCard";

export interface PredictionSummaryProps {
  result: PredictionResult;
  teamA: Team;
  teamB: Team;
}

export function PredictionSummary({ result, teamA, teamB }: PredictionSummaryProps) {
  const winner = result.predictedWinnerId === teamA.id ? teamA : teamB;
  const loser = result.predictedWinnerId === teamA.id ? teamB : teamA;

  return (
    <Card className="flex flex-col gap-lg">
      <ResultHeader winner={winner} loser={loser} confidence={result.confidence} />
      <ProbabilityCard teamA={teamA} teamB={teamB} outcomes={result.outcomes} />
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <Meter label="Confidence" value={result.confidence} />
        <Meter label="Trust Score" value={result.trustScore} />
      </div>
    </Card>
  );
}
