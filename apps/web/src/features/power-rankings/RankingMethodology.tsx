import { SyntheticScenarioBadge } from "../prediction-studio/SyntheticScenarioBadge";

export interface RankingMethodologyProps {
  /** Already adapted via `adaptDisclosureForPowerRankings` by the caller. */
  disclosure: string;
  className?: string;
}

/**
 * Reuses the same synthetic-data disclosure badge Comparison Lab already
 * shows (`SyntheticScenarioBadge`) rather than inventing a second disclosure
 * treatment, plus one page-specific sentence naming the exact weighting so
 * the Power Score never reads as an unexplained number.
 */
export function RankingMethodology({ disclosure, className }: RankingMethodologyProps) {
  return (
    <div className={className}>
      <SyntheticScenarioBadge disclosure={disclosure} />
      <p className="pt-2xs text-xs text-muted-foreground">
        Power Score combines overall rating (35%), recent form (25%), map depth (20%), consistency (15%), and
        clutch performance (5%) into one comparative score. It is a modeled analytical ranking, not an official
        VCT ranking.
      </p>
    </div>
  );
}
