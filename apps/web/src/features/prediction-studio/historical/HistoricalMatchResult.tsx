import type { HistoricalPredictionResponse } from "@repo/shared";
import { Badge, Card, Stack } from "@repo/ui";

export interface HistoricalMatchResultProps {
  result: HistoricalPredictionResponse;
}

function formatPercent(probability: number): string {
  return `${Math.round(probability * 100)}%`;
}

/**
 * Restrained real-model result display — TASK-047 requirement 13. Shows
 * only the probability, predicted side, and model provenance; never
 * fabricates feature importance for the Elo model, never reveals the
 * historical match's actual outcome by default (`resultAvailability` is
 * advisory metadata only — no reveal control is built in this pass, see
 * docs/35 "Known limitations").
 */
export function HistoricalMatchResult({ result }: HistoricalMatchResultProps) {
  return (
    <Card>
      <Stack gap="sm">
        <div className="flex items-center justify-between gap-sm">
          <h3 className="text-lg font-semibold">Historical Model Replay</h3>
          <Badge tone="brand">Real trained model</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Prediction generated from information available before this match. Not a live or future forecast.
        </p>

        <div className="flex items-center gap-md">
          <div>
            <p className="text-xs text-muted-foreground">Team A</p>
            <p className="text-2xl font-semibold">{formatPercent(result.teamAWinProbability)}</p>
          </div>
          <div className="text-muted-foreground">vs</div>
          <div>
            <p className="text-xs text-muted-foreground">Team B</p>
            <p className="text-2xl font-semibold">{formatPercent(result.teamBWinProbability)}</p>
          </div>
        </div>

        <p className="text-sm">
          Predicted side: <span className="font-medium">{result.predictedWinnerSide === "teamA" ? "Team A" : "Team B"}</span>{" "}
          <span className="text-muted-foreground">(confidence {formatPercent(result.confidence)})</span>
        </p>

        <dl className="grid grid-cols-2 gap-x-md gap-y-2xs text-xs text-muted-foreground">
          <dt>Model version</dt>
          <dd className="text-foreground">{result.modelVersion}</dd>
          <dt>Estimator</dt>
          <dd className="text-foreground">{result.estimatorType}</dd>
          <dt>Calibration</dt>
          <dd className="text-foreground">{result.calibrationMethod}</dd>
          <dt>Feature dataset</dt>
          <dd className="text-foreground">{result.dataProvenance.sourceFeatureDatasetVersion}</dd>
        </dl>

        {result.warnings.length > 0 ? (
          <ul className="flex flex-col gap-3xs">
            {result.warnings.map((warning) => (
              <li key={warning} className="text-xs text-warning">
                {warning}
              </li>
            ))}
          </ul>
        ) : null}
      </Stack>
    </Card>
  );
}
