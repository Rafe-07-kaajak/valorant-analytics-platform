import type { GameMap } from "@repo/shared";
import type { ComparisonFactor, ComparisonMetric, MapComparisonRow, MapHighlight, VctTeamProfile } from "./types";
import { buildOverviewMetrics } from "./metrics";
import { compareMaps, largestGapMap, mostEvenMap, strongestMap, weakestMap } from "./maps";
import { deriveFactors } from "./factors";
import { generateNeutralSummary } from "./summary";

export interface ComparisonViewModel {
  teamAId: string;
  teamBId: string;
  metrics: ComparisonMetric[];
  mapRows: MapComparisonRow[];
  strongestA: MapHighlight | null;
  weakestA: MapHighlight | null;
  strongestB: MapHighlight | null;
  weakestB: MapHighlight | null;
  mostEvenMap: MapComparisonRow | null;
  largestGapMap: MapComparisonRow | null;
  factors: ComparisonFactor[];
  summary: string;
}

/**
 * The single entry point that derives everything the four tabs need from a
 * selected team pair. Callers (TeamComparisonClient) should compute this
 * once per selected pair inside a `useMemo`, not per render or per tab
 * switch — every sub-computation here is pure and deterministic.
 */
export function buildComparisonViewModel(
  profileA: VctTeamProfile,
  profileB: VctTeamProfile,
  teamAName: string,
  teamBName: string,
  maps: readonly GameMap[],
): ComparisonViewModel {
  const metrics = buildOverviewMetrics(profileA, profileB);
  const mapRows = compareMaps(profileA, profileB, maps);
  const factors = deriveFactors(profileA, profileB, teamAName, teamBName);
  const summary = generateNeutralSummary(teamAName, teamBName, factors);

  return {
    teamAId: profileA.teamId,
    teamBId: profileB.teamId,
    metrics,
    mapRows,
    strongestA: strongestMap(profileA, maps),
    weakestA: weakestMap(profileA, maps),
    strongestB: strongestMap(profileB, maps),
    weakestB: weakestMap(profileB, maps),
    mostEvenMap: mostEvenMap(mapRows),
    largestGapMap: largestGapMap(mapRows),
    factors,
    summary,
  };
}
