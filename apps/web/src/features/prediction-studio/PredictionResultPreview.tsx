import type { PredictionResult, Team } from "@repo/shared";
import { Card } from "@repo/ui";

export interface PredictionResultPreviewProps {
  result: PredictionResult;
  teams: Team[];
}

export function PredictionResultPreview({ result, teams }: PredictionResultPreviewProps) {
  const findTeamName = (teamId: string) => teams.find((team) => team.id === teamId)?.name ?? teamId;
  const winner = findTeamName(result.predictedWinnerId);

  return (
    <Card className="flex flex-col gap-md">
      <div>
        <p className="text-sm text-muted-foreground">Predicted Winner</p>
        <h3>{winner}</h3>
      </div>

      <div className="grid grid-cols-2 gap-md">
        {result.outcomes.map((outcome) => (
          <div key={outcome.teamId}>
            <p className="text-sm text-muted-foreground">{findTeamName(outcome.teamId)}</p>
            <p className="text-2xl font-semibold text-foreground">
              {Math.round(outcome.winProbability * 100)}%
            </p>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">Confidence: {result.confidence}%</p>

      {result.warnings.map((warning) => (
        <p key={warning} className="text-sm text-warning">
          {warning}
        </p>
      ))}
    </Card>
  );
}
