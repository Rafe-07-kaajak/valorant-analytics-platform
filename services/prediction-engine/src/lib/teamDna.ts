import type { DnaDimensionKey, DnaDimensionScore, TeamDna } from "@repo/shared";
import { getFeatureRegistry } from "./featureRegistry";
import { normalizedMatchHistory } from "./normalizeMatchHistory";
import type { NormalizedMatchHistory, NormalizedTeamAggregate } from "./normalizeMatchHistory";

/**
 * Team DNA — see docs/10-prediction-engine.md ("Feature Extraction") and
 * docs/16-prediction-pipeline.md (Step 5 — Team DNA). Every dimension is
 * computed from the TASK-013 normalized aggregates rather than a random
 * seed; formulas are documented per-feature in featureRegistry.ts, which is
 * this module's single source of truth for dimension metadata.
 */

const NEUTRAL_SCORE = 50;
const MIN_SCORE = 0;
const MAX_SCORE = 100;
const ADAPTABILITY_SPREAD_SCALE = 200;
const TEMPO_DIFFERENTIAL_SCALE = 4;
const MIN_MAPS_FOR_ADAPTABILITY = 2;

const DNA_DIMENSIONS: { key: DnaDimensionKey; label: string }[] = getFeatureRegistry().map((feature) => ({
  key: feature.key,
  label: feature.name,
}));

export function clampScore(value: number): number {
  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, Math.round(value)));
}

/** Whether a dimension has enough normalized data to compute a real value. */
function isDimensionCovered(key: DnaDimensionKey, aggregate: NormalizedTeamAggregate): boolean {
  switch (key) {
    case "aggression":
      return aggregate.entrySuccessRate !== null;
    case "utilityEfficiency":
      return aggregate.economyOutcomeRates.fullBuy !== null;
    case "mapControl":
      return aggregate.roundWinRate !== null;
    case "clutchAbility":
      return aggregate.clutchConversionRate !== null;
    case "adaptability":
      return (
        Object.values(aggregate.mapPerformance).filter((map) => map.winRate !== null).length >=
        MIN_MAPS_FOR_ADAPTABILITY
      );
    case "tempo":
      return aggregate.averageRoundDifferential !== null;
    default:
      return false;
  }
}

function computeAdaptability(aggregate: NormalizedTeamAggregate): number {
  const winRates = Object.values(aggregate.mapPerformance)
    .map((map) => map.winRate)
    .filter((rate): rate is number => rate !== null);

  const mean = winRates.reduce((sum, rate) => sum + rate, 0) / winRates.length;
  const variance = winRates.reduce((sum, rate) => sum + (rate - mean) ** 2, 0) / winRates.length;
  const stdDev = Math.sqrt(variance);

  return clampScore(MAX_SCORE - stdDev * ADAPTABILITY_SPREAD_SCALE);
}

function computeTempo(aggregate: NormalizedTeamAggregate): number {
  return clampScore(NEUTRAL_SCORE + Math.abs(aggregate.averageRoundDifferential!) * TEMPO_DIFFERENTIAL_SCALE);
}

/**
 * Falls back to a neutral score (50) when a dimension lacks sufficient
 * normalized data, per docs/08-ai-pipeline.md's failure strategy ("Missing
 * Feature -> Fallback Feature -> Lower Confidence -> Prediction Continues").
 */
function computeDimensionValue(key: DnaDimensionKey, aggregate: NormalizedTeamAggregate | undefined): number {
  if (!aggregate || !isDimensionCovered(key, aggregate)) return NEUTRAL_SCORE;

  switch (key) {
    case "aggression":
      return clampScore(aggregate.entrySuccessRate! * 100);
    case "utilityEfficiency":
      return clampScore(aggregate.economyOutcomeRates.fullBuy! * 100);
    case "mapControl":
      return clampScore(aggregate.roundWinRate! * 100);
    case "clutchAbility":
      return clampScore(aggregate.clutchConversionRate! * 100);
    case "adaptability":
      return computeAdaptability(aggregate);
    case "tempo":
      return computeTempo(aggregate);
    default:
      return NEUTRAL_SCORE;
  }
}

/**
 * Computes a team's behavioral profile from normalized match history. A
 * custom `normalizedHistory` can be supplied for testing against known
 * fixture aggregates; production callers rely on the default.
 */
export function generateTeamDna(
  teamId: string,
  normalizedHistory: NormalizedMatchHistory = normalizedMatchHistory,
): TeamDna {
  const aggregate = normalizedHistory.teams[teamId];

  const dimensions: DnaDimensionScore[] = DNA_DIMENSIONS.map(({ key, label }) => ({
    key,
    label,
    value: computeDimensionValue(key, aggregate),
  }));

  return { teamId, dimensions };
}

/**
 * Fraction (0-1) of registered Team DNA features backed by sufficient
 * normalized data for the given team — feeds TASK-016's trust score.
 */
export function getFeatureCoverage(
  teamId: string,
  normalizedHistory: NormalizedMatchHistory = normalizedMatchHistory,
): number {
  const aggregate = normalizedHistory.teams[teamId];
  if (!aggregate) return 0;

  const registry = getFeatureRegistry();
  if (registry.length === 0) return 0;

  const covered = registry.filter((feature) => isDimensionCovered(feature.key, aggregate)).length;
  return covered / registry.length;
}

/**
 * How closely a team's last-10-match form agrees with its overall win rate
 * (1 = perfectly stable, 0 = maximally divergent) — feeds TASK-016's
 * confidence score as a historical-consistency signal. Falls back to a
 * neutral 0.5 when either rate is unavailable.
 */
export function computeFormStability(
  teamId: string,
  normalizedHistory: NormalizedMatchHistory = normalizedMatchHistory,
): number {
  const aggregate = normalizedHistory.teams[teamId];
  const overall = aggregate?.overallWinRate;
  const recent = aggregate?.recentForm.last10.winRate;

  if (overall === null || overall === undefined || recent === null || recent === undefined) {
    return 0.5;
  }

  return 1 - Math.abs(overall - recent);
}

export { DNA_DIMENSIONS };
