import type { DnaDimensionKey, MatchDna, TeamDna } from "@repo/shared";
import { getFeatureRegistry } from "./featureRegistry";

export function generateMatchDna(teamADna: TeamDna, teamBDna: TeamDna): MatchDna {
  const diffs = teamADna.dimensions.map((dimension) => {
    const opposing = teamBDna.dimensions.find((d) => d.key === dimension.key);
    const diff = Math.abs(dimension.value - (opposing?.value ?? dimension.value));
    return { key: dimension.key, diff, average: (dimension.value + (opposing?.value ?? 0)) / 2 };
  });

  const averageDiff = diffs.reduce((sum, d) => sum + d.diff, 0) / diffs.length;
  const similarityScore = Math.round(Math.max(0, 100 - averageDiff * 1.4));

  const conflictingTraits: DnaDimensionKey[] = diffs
    .filter((d) => d.diff >= 20)
    .sort((a, b) => b.diff - a.diff)
    .map((d) => d.key);

  const complementaryTraits: DnaDimensionKey[] = diffs
    .filter((d) => d.diff < 12 && d.average >= 55)
    .map((d) => d.key);

  const decisiveTrait = [...diffs].sort((a, b) => b.diff - a.diff)[0]!.key;

  return { similarityScore, complementaryTraits, conflictingTraits, decisiveTrait };
}

/**
 * Team A's aggregated DNA advantage over Team B, weighted per the Feature
 * Registry (TASK-015). Positive values favor Team A, negative favor Team B.
 * Feeds TASK-016's win probability — the sign and magnitude of a team's
 * DNA lead determines how strongly it is favored.
 */
export function computeWeightedAdvantage(teamADna: TeamDna, teamBDna: TeamDna): number {
  const registry = getFeatureRegistry();
  const totalWeight = registry.reduce((sum, feature) => sum + feature.weight, 0);
  if (totalWeight === 0) return 0;

  const weightedDiffSum = registry.reduce((sum, feature) => {
    const a = teamADna.dimensions.find((dimension) => dimension.key === feature.key)?.value ?? 0;
    const b = teamBDna.dimensions.find((dimension) => dimension.key === feature.key)?.value ?? 0;
    return sum + feature.weight * (a - b);
  }, 0);

  return weightedDiffSum / totalWeight;
}

/**
 * Fraction (0-1) of Team A's DNA dimensions whose lead direction agrees with
 * the overall weighted advantage — feeds TASK-016's confidence score as a
 * feature-agreement signal. A tied dimension never counts against agreement.
 */
export function computeDimensionAgreement(teamADna: TeamDna, teamBDna: TeamDna, weightedAdvantage: number): number {
  if (teamADna.dimensions.length === 0) return 0;

  const advantageSign = Math.sign(weightedAdvantage);
  const agreeing = teamADna.dimensions.filter((dimension) => {
    const opposing = teamBDna.dimensions.find((d) => d.key === dimension.key)?.value ?? dimension.value;
    const diffSign = Math.sign(dimension.value - opposing);
    return diffSign === 0 || advantageSign === 0 || diffSign === advantageSign;
  }).length;

  return agreeing / teamADna.dimensions.length;
}
