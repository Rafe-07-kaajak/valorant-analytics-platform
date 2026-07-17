import type { TeamDna } from "@repo/shared";
import type { ComparisonMetric, VctTeamProfile } from "./types";
import { classifyDifference, PERCENT_SCALE_THRESHOLDS, ROUND_DIFFERENTIAL_THRESHOLDS } from "./thresholds";

interface MetricDefinition {
  key: keyof Pick<
    VctTeamProfile,
    | "overallRating"
    | "recentFormIndex"
    | "attackStrength"
    | "defenseStrength"
    | "economyEfficiency"
    | "clutchPerformance"
    | "consistency"
    | "roundDifferential"
  >;
  label: string;
  /** Only `roundDifferential` uses the narrower band — see thresholds.ts. */
  usesRoundDifferentialScale?: boolean;
}

/** The Overview tab's required metric set, in display order. */
export const OVERVIEW_METRIC_DEFINITIONS: readonly MetricDefinition[] = [
  { key: "overallRating", label: "Overall Rating" },
  { key: "recentFormIndex", label: "Recent Form" },
  { key: "attackStrength", label: "Attack Strength" },
  { key: "defenseStrength", label: "Defense Strength" },
  { key: "economyEfficiency", label: "Economy Efficiency" },
  { key: "clutchPerformance", label: "Clutch Performance" },
  { key: "consistency", label: "Consistency" },
  { key: "roundDifferential", label: "Round Differential", usesRoundDifferentialScale: true },
];

/**
 * Builds the paired Overview metrics for two profiles. Pure and
 * deterministic — the same pair of profiles always produces the same
 * output, so callers should memoize this per selected team pair rather
 * than recomputing on unrelated rerenders.
 */
export function buildOverviewMetrics(profileA: VctTeamProfile, profileB: VctTeamProfile): ComparisonMetric[] {
  return OVERVIEW_METRIC_DEFINITIONS.map(({ key, label, usesRoundDifferentialScale }) => {
    const valueA = profileA[key];
    const valueB = profileB[key];
    const thresholds = usesRoundDifferentialScale ? ROUND_DIFFERENTIAL_THRESHOLDS : PERCENT_SCALE_THRESHOLDS;
    const difference = classifyDifference(valueA, valueB, thresholds);
    return { key, label, valueA, valueB, ...difference };
  });
}

/**
 * Point-by-point comparison across all six canonical Team DNA dimensions
 * (aggression, tempo, map control, utility efficiency, adaptability, clutch
 * ability) — distinct from `deriveFactors`, which curates a smaller,
 * cross-profile "most important differences" set for the Factors tab.
 */
export function compareDnaDimensions(teamADna: TeamDna, teamBDna: TeamDna): ComparisonMetric[] {
  return teamADna.dimensions.map((dimensionA) => {
    const dimensionB = teamBDna.dimensions.find((candidate) => candidate.key === dimensionA.key);
    const valueB = dimensionB?.value ?? 0;
    const difference = classifyDifference(dimensionA.value, valueB);
    return { key: dimensionA.key, label: dimensionA.label, valueA: dimensionA.value, valueB, ...difference };
  });
}
