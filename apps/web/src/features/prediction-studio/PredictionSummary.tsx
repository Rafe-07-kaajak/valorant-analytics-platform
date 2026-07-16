import type { PredictionResult, Team } from "@repo/shared";
import { Info } from "lucide-react";
import { Button, Card, Icon, Meter, Tooltip } from "@repo/ui";
import { ResultHeader } from "./ResultHeader";
import { ProbabilityCard } from "./ProbabilityCard";

export interface PredictionSummaryProps {
  result: PredictionResult;
  teamA: Team;
  teamB: Team;
}

interface ScoreWithExplanationProps {
  label: string;
  value: number;
  explanation?: string;
}

/**
 * A Meter paired with a keyboard-reachable info affordance whose content is
 * the matching Insight description generated in `insights.ts` — real,
 * per-prediction reasoning rather than a static definition, per TASK-020.
 */
function ScoreWithExplanation({ label, value, explanation }: ScoreWithExplanationProps) {
  return (
    <div className="flex items-end gap-2xs">
      <Meter label={label} value={value} className="flex-1" />
      {explanation ? (
        <Tooltip content={explanation}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 px-0"
            aria-label={`What does ${label} mean?`}
          >
            <Icon icon={Info} size={16} />
          </Button>
        </Tooltip>
      ) : null}
    </div>
  );
}

export function PredictionSummary({ result, teamA, teamB }: PredictionSummaryProps) {
  const winner = result.predictedWinnerId === teamA.id ? teamA : teamB;
  const loser = result.predictedWinnerId === teamA.id ? teamB : teamA;

  const confidenceExplanation = result.insights.find((insight) => insight.id === "confidence-explanation");
  const trustScoreExplanation = result.insights.find((insight) => insight.id === "trust-score-explanation");

  return (
    <Card className="flex flex-col gap-lg">
      <ResultHeader winner={winner} loser={loser} confidence={result.confidence} />
      <ProbabilityCard teamA={teamA} teamB={teamB} outcomes={result.outcomes} />
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <ScoreWithExplanation
          label="Confidence"
          value={result.confidence}
          explanation={confidenceExplanation?.description}
        />
        <ScoreWithExplanation
          label="Trust Score"
          value={result.trustScore}
          explanation={trustScoreExplanation?.description}
        />
      </div>
    </Card>
  );
}
