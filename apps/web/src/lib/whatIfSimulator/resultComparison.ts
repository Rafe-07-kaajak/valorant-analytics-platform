import type { DnaDimensionKey, KeyFactor, PredictionResult } from "@repo/shared";
import { buildContributionRows, type ContributionRow } from "../predictionBreakdown";

/** Below this, a probability-point change is described as "limited" rather than quantified as if it were meaningful. */
const TINY_CHANGE_THRESHOLD_POINTS = 1;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function probabilityPoints(value: number): number {
  return round1(value * 100);
}

export interface ProbabilityComparison {
  teamAId: string;
  teamBId: string;
  baselineTeamAProbabilityPoints: number;
  simulatedTeamAProbabilityPoints: number;
  teamAProbabilityDeltaPoints: number;
  baselineTeamBProbabilityPoints: number;
  simulatedTeamBProbabilityPoints: number;
  teamBProbabilityDeltaPoints: number;
  baselinePredictedWinnerId: string;
  simulatedPredictedWinnerId: string;
  winnerChanged: boolean;
  baselineConfidence: number;
  simulatedConfidence: number;
  confidenceDeltaPoints: number;
  baselineTrustScore: number;
  simulatedTrustScore: number;
  trustScoreDeltaPoints: number;
}

/**
 * All deltas are expressed in percentage points (simulated minus baseline),
 * never as percent growth — a move from 40% to 44% is "+4 points", not
 * "+10%". NaN-safe: falls back to 0 for a missing outcome rather than
 * propagating `NaN` into the UI.
 */
export function compareOutcomes(baseline: PredictionResult, simulated: PredictionResult): ProbabilityComparison {
  const [teamAId, teamBId] = [baseline.outcomes[0].teamId, baseline.outcomes[1].teamId];

  const baselineA = baseline.outcomes.find((o) => o.teamId === teamAId)?.winProbability ?? 0;
  const baselineB = baseline.outcomes.find((o) => o.teamId === teamBId)?.winProbability ?? 0;
  const simulatedA = simulated.outcomes.find((o) => o.teamId === teamAId)?.winProbability ?? baselineA;
  const simulatedB = simulated.outcomes.find((o) => o.teamId === teamBId)?.winProbability ?? baselineB;

  return {
    teamAId,
    teamBId,
    baselineTeamAProbabilityPoints: probabilityPoints(baselineA),
    simulatedTeamAProbabilityPoints: probabilityPoints(simulatedA),
    teamAProbabilityDeltaPoints: round1(probabilityPoints(simulatedA) - probabilityPoints(baselineA)),
    baselineTeamBProbabilityPoints: probabilityPoints(baselineB),
    simulatedTeamBProbabilityPoints: probabilityPoints(simulatedB),
    teamBProbabilityDeltaPoints: round1(probabilityPoints(simulatedB) - probabilityPoints(baselineB)),
    baselinePredictedWinnerId: baseline.predictedWinnerId,
    simulatedPredictedWinnerId: simulated.predictedWinnerId,
    winnerChanged: baseline.predictedWinnerId !== simulated.predictedWinnerId,
    baselineConfidence: baseline.confidence,
    simulatedConfidence: simulated.confidence,
    confidenceDeltaPoints: simulated.confidence - baseline.confidence,
    baselineTrustScore: baseline.trustScore,
    simulatedTrustScore: simulated.trustScore,
    trustScoreDeltaPoints: simulated.trustScore - baseline.trustScore,
  };
}

export interface KeyFactorChange {
  id: string;
  label: string;
  status: "new" | "removed" | "changed" | "unchanged";
  baselineMagnitude: number | null;
  simulatedMagnitude: number | null;
  magnitudeDeltaPoints: number;
}

/** Sorted by the largest absolute magnitude change first, alphabetical-by-label tie-break — stable and deterministic. */
export function diffKeyFactors(baseline: PredictionResult, simulated: PredictionResult): KeyFactorChange[] {
  const byId = new Map<string, { baseline?: KeyFactor; simulated?: KeyFactor }>();
  for (const factor of baseline.keyFactors) byId.set(factor.id, { ...byId.get(factor.id), baseline: factor });
  for (const factor of simulated.keyFactors) byId.set(factor.id, { ...byId.get(factor.id), simulated: factor });

  const changes: KeyFactorChange[] = Array.from(byId.entries()).map(([id, { baseline: b, simulated: s }]) => {
    const label = (s ?? b)!.label;
    const baselineMagnitude = b?.magnitude ?? null;
    const simulatedMagnitude = s?.magnitude ?? null;
    const magnitudeDeltaPoints = round1((simulatedMagnitude ?? 0) - (baselineMagnitude ?? 0));
    const status: KeyFactorChange["status"] = !b ? "new" : !s ? "removed" : magnitudeDeltaPoints !== 0 ? "changed" : "unchanged";

    return { id, label, status, baselineMagnitude, simulatedMagnitude, magnitudeDeltaPoints };
  });

  return changes.sort((a, b) => Math.abs(b.magnitudeDeltaPoints) - Math.abs(a.magnitudeDeltaPoints) || a.label.localeCompare(b.label));
}

export interface ContributionChange {
  id: string;
  label: string;
  baselineShareOfTotal: number | null;
  simulatedShareOfTotal: number | null;
  shareDeltaPoints: number;
}

/** Reuses TASK-037's `buildContributionRows` on both results, then diffs by dimension id — never recomputes the underlying magnitude/probability math itself. */
export function diffContributions(baseline: PredictionResult, simulated: PredictionResult, teamAId: string): ContributionChange[] {
  const baselineRows = buildContributionRows(baseline.keyFactors, baseline.predictedWinnerId, teamAId);
  const simulatedRows = buildContributionRows(simulated.keyFactors, simulated.predictedWinnerId, teamAId);

  const byId = new Map<string, { baseline?: ContributionRow; simulated?: ContributionRow }>();
  for (const row of baselineRows) byId.set(row.id, { ...byId.get(row.id), baseline: row });
  for (const row of simulatedRows) byId.set(row.id, { ...byId.get(row.id), simulated: row });

  const changes: ContributionChange[] = Array.from(byId.entries()).map(([id, { baseline: b, simulated: s }]) => ({
    id,
    label: (s ?? b)!.label,
    baselineShareOfTotal: b?.shareOfTotal ?? null,
    simulatedShareOfTotal: s?.shareOfTotal ?? null,
    shareDeltaPoints: (s?.shareOfTotal ?? 0) - (b?.shareOfTotal ?? 0),
  }));

  return changes.sort((a, b) => Math.abs(b.shareDeltaPoints) - Math.abs(a.shareDeltaPoints) || a.label.localeCompare(b.label));
}

export interface DnaDimensionChange {
  teamId: string;
  key: DnaDimensionKey;
  label: string;
  baselineValue: number;
  simulatedValue: number;
  deltaPoints: number;
}

export interface MatchDnaComparison {
  dimensionChanges: DnaDimensionChange[];
  baselineSimilarityScore: number;
  simulatedSimilarityScore: number;
  similarityScoreDeltaPoints: number;
  baselineDecisiveTrait: DnaDimensionKey;
  simulatedDecisiveTrait: DnaDimensionKey;
  decisiveTraitChanged: boolean;
}

/** Per-team, per-dimension value changes, sorted by largest absolute change first. */
export function diffMatchDna(baseline: PredictionResult, simulated: PredictionResult): MatchDnaComparison {
  const dimensionChanges: DnaDimensionChange[] = [];

  for (const baselineTeamDna of baseline.teamDna) {
    const simulatedTeamDna = simulated.teamDna.find((dna) => dna.teamId === baselineTeamDna.teamId);
    if (!simulatedTeamDna) continue;

    for (const dimension of baselineTeamDna.dimensions) {
      const simulatedDimension = simulatedTeamDna.dimensions.find((d) => d.key === dimension.key);
      if (!simulatedDimension) continue;
      const deltaPoints = simulatedDimension.value - dimension.value;
      if (deltaPoints === 0) continue;
      dimensionChanges.push({
        teamId: baselineTeamDna.teamId,
        key: dimension.key,
        label: dimension.label,
        baselineValue: dimension.value,
        simulatedValue: simulatedDimension.value,
        deltaPoints,
      });
    }
  }

  dimensionChanges.sort((a, b) => Math.abs(b.deltaPoints) - Math.abs(a.deltaPoints) || a.label.localeCompare(b.label));

  return {
    dimensionChanges,
    baselineSimilarityScore: baseline.matchDna.similarityScore,
    simulatedSimilarityScore: simulated.matchDna.similarityScore,
    similarityScoreDeltaPoints: simulated.matchDna.similarityScore - baseline.matchDna.similarityScore,
    baselineDecisiveTrait: baseline.matchDna.decisiveTrait,
    simulatedDecisiveTrait: simulated.matchDna.decisiveTrait,
    decisiveTraitChanged: baseline.matchDna.decisiveTrait !== simulated.matchDna.decisiveTrait,
  };
}

/**
 * Neutral-tone, deterministic summary sentence — never implies a guaranteed
 * real-world outcome, and explicitly says when a change is too small to be
 * meaningful rather than dressing up noise as a finding.
 */
export function buildSimulationSummary(
  comparison: ProbabilityComparison,
  teamAName: string,
  teamBName: string,
): string {
  const winnerName = comparison.simulatedPredictedWinnerId === comparison.teamAId ? teamAName : teamBName;
  const baselineWinnerName = comparison.baselinePredictedWinnerId === comparison.teamAId ? teamAName : teamBName;

  if (comparison.winnerChanged) {
    return `The simulated profile changes the projected winner from ${baselineWinnerName} to ${winnerName}. This reflects the combined modeled adjustments, not a forecast of real performance.`;
  }

  if (Math.abs(comparison.teamAProbabilityDeltaPoints) < TINY_CHANGE_THRESHOLD_POINTS) {
    return `The hypothetical adjustments have a limited effect on the modeled win probability (less than ${TINY_CHANGE_THRESHOLD_POINTS} percentage point), and ${winnerName} remains the projected winner.`;
  }

  const direction = comparison.teamAProbabilityDeltaPoints > 0 ? "increase" : "decrease";
  return `The hypothetical adjustments ${direction} ${teamAName}'s modeled win probability by ${Math.abs(comparison.teamAProbabilityDeltaPoints)} percentage points, but ${winnerName} remains the projected winner.`;
}
