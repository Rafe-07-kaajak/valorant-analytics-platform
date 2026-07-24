import { Meter, MotionNumber } from "@repo/ui";
import type { VctTeamProfile } from "@repo/prediction-engine";
import type { PowerScoreExplainability } from "./rankingTypes";

export interface PowerScoreBreakdownProps {
  /** Present only for the synthetic-scenario path. */
  profile?: VctTeamProfile;
  /** Present only for the real-data path. */
  explainability?: PowerScoreExplainability;
  mapDepthScore: number;
  powerScore: number;
  className?: string;
}

/**
 * The weighted inputs behind a team's Power Score, each shown as its own
 * `Meter` so the composite never reads as an unexplained single number.
 * Renders one of two mutually-exclusive breakdowns depending on which prop
 * is present (see `rankingTypes.ts`'s doc comment on why `profile` and
 * `explainability` never coexist on the same entry):
 *  - synthetic (`profile`): the five weights literally specified in
 *    `rankingModel.ts`'s `computePowerScore` — unchanged from before this
 *    task.
 *  - real-data (`explainability`): the real composite from
 *    `computeRealPowerScore` — an explicit uncertainty penalty row instead
 *    of a fabricated clutch-performance meter, since the real feature set
 *    has no clutch equivalent.
 */
export function PowerScoreBreakdown({ profile, explainability, mapDepthScore, powerScore, className }: PowerScoreBreakdownProps) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-sm border-b border-surface-border pb-sm">
        <span className="text-sm font-medium text-foreground">Power Score</span>
        <MotionNumber value={powerScore} format="decimal" decimals={2} className="text-2xl font-semibold text-foreground" />
      </div>

      {explainability ? (
        <div className="flex flex-col gap-sm pt-sm">
          <Meter label="Baseline rating (Elo, weight 35%)" value={explainability.baseRating / 0.35} valueLabel={explainability.baseRating.toFixed(2)} tone="brand" />
          <Meter label="Recent form (weight 25%)" value={explainability.formContribution / 0.25} valueLabel={explainability.formContribution.toFixed(2)} tone="brand" />
          <Meter
            label="Opponent-adjusted strength (weight 15%)"
            value={explainability.opponentAdjustedContribution / 0.15}
            valueLabel={explainability.opponentAdjustedContribution.toFixed(2)}
            tone="brand"
          />
          <Meter label="Map depth (weight 10%)" value={mapDepthScore} valueLabel={`${Math.round(mapDepthScore)}%`} tone="brand" />
          <Meter
            label="Competition tier (weight 10%)"
            value={explainability.competitionTierContribution / 0.1}
            valueLabel={explainability.competitionTierContribution.toFixed(2)}
            tone="brand"
          />
          <Meter
            label="Consistency (weight 5%)"
            value={explainability.consistencyContribution / 0.05}
            valueLabel={explainability.consistencyContribution.toFixed(2)}
            tone="brand"
          />
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Uncertainty penalty (low sample size)</span>
            <span className="font-medium text-foreground">{explainability.uncertaintyPenalty.toFixed(2)}</span>
          </div>
        </div>
      ) : profile ? (
        <div className="flex flex-col gap-sm pt-sm">
          <Meter label="Overall rating (weight 35%)" value={profile.overallRating} tone="brand" />
          <Meter label="Recent form (modeled, weight 25%)" value={profile.recentFormIndex} tone="brand" />
          <Meter label="Map depth (weight 20%)" value={mapDepthScore} valueLabel={`${Math.round(mapDepthScore)}%`} tone="brand" />
          <Meter label="Consistency (weight 15%)" value={profile.consistency} tone="brand" />
          <Meter label="Clutch performance (weight 5%)" value={profile.clutchPerformance} tone="brand" />
        </div>
      ) : null}
    </div>
  );
}
