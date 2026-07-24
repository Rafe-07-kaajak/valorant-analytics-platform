import { Card } from "@repo/ui";
import type { CurrentPredictionResponse } from "@repo/shared";

export interface RealModelContributionsTabProps {
  result: CurrentPredictionResponse;
  teamAName: string;
  teamBName: string;
}

function formatSignedProbability(value: number): string {
  const points = Math.round(value * 1000) / 10;
  return `${points >= 0 ? "+" : ""}${points.toFixed(1)} pts`;
}

/**
 * Tab 1 of the Real Prediction Breakdown ("Model Contributions"). Unlike the
 * synthetic Contributions tab (which ranks several Team DNA dimensions by
 * modeled share of the prediction), the deployed `elo-baseline` estimator has
 * exactly one real driver — this tab shows that one driver's full real math
 * (Elo differential -> uncalibrated probability -> calibration -> final
 * probability) rather than a ranked list, since a ranked list of one item
 * would misrepresent how the model actually works. See `docs` on
 * `RealMatchContribution` for why this stays estimator-aware rather than
 * hardcoded to Elo.
 */
export function RealModelContributionsTab({ result, teamAName, teamBName }: RealModelContributionsTabProps) {
  const { contribution } = result;
  const favorsTeamA = contribution.driverDifferential >= 0;
  const favoredName = favorsTeamA ? teamAName : teamBName;

  return (
    <div className="flex flex-col gap-md">
      <p className="text-sm text-muted-foreground">
        {contribution.isSoleDriver
          ? `The currently selected ${result.estimatorType} estimator derives its prediction from exactly one real signal below. Every other real metric in this result is supporting context, not a model input.`
          : `The currently selected ${result.estimatorType} estimator's real per-feature contributions are shown below.`}
      </p>

      <Card className="flex flex-col gap-sm">
        <div className="flex items-center justify-between gap-sm">
          <span className="font-medium text-foreground">{contribution.driverLabel}</span>
          <span className="text-sm text-muted-foreground">favors {favoredName}</span>
        </div>
        <dl className="grid grid-cols-2 gap-x-md gap-y-2xs text-sm">
          <dt className="text-muted-foreground">Elo differential (A minus B)</dt>
          <dd className="text-right font-mono text-foreground">{Math.round(contribution.driverDifferential)}</dd>
          <dt className="text-muted-foreground">Uncalibrated probability (Team A)</dt>
          <dd className="text-right font-mono text-foreground">{(contribution.uncalibratedProbability * 100).toFixed(1)}%</dd>
          <dt className="text-muted-foreground">Calibration adjustment</dt>
          <dd className="text-right font-mono text-foreground">{formatSignedProbability(contribution.calibrationAdjustment)}</dd>
          <dt className="text-muted-foreground">Final probability (Team A)</dt>
          <dd className="text-right font-mono font-semibold text-foreground">{(contribution.finalProbability * 100).toFixed(1)}%</dd>
        </dl>
      </Card>
    </div>
  );
}
