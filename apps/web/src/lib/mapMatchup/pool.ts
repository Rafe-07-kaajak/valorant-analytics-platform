import type { MapComparisonRow } from "../teamComparison";
import { classifyDifference } from "../teamComparison";
import type { PoolAggregate } from "./types";

function extreme(
  pool: readonly MapComparisonRow[],
  better: (candidate: MapComparisonRow, current: MapComparisonRow) => boolean,
): MapComparisonRow | null {
  return pool.reduce<MapComparisonRow | null>((best, row) => (!best || better(row, best) ? row : best), null);
}

/**
 * Aggregates the selected map pool into a single pair-level picture:
 * average modeled strength, aggregate gap/classification (same threshold
 * bands as everything else — see teamComparison/thresholds.ts), per-side
 * favor counts, and the pool-scoped strongest/closest/largest-gap maps
 * (distinct from the roster-wide strongest/weakest map, which considers
 * every map regardless of pool membership). Returns null for an empty
 * pool — callers should show the map-pool empty state instead.
 */
export function computePoolAggregate(
  rows: readonly MapComparisonRow[],
  selectedMapIds: readonly string[],
): PoolAggregate | null {
  const pool = rows.filter((row) => selectedMapIds.includes(row.mapId));
  if (pool.length === 0) return null;

  const averageA = pool.reduce((sum, row) => sum + row.scoreA, 0) / pool.length;
  const averageB = pool.reduce((sum, row) => sum + row.scoreB, 0) / pool.length;
  const difference = classifyDifference(averageA, averageB);

  return {
    mapCount: pool.length,
    averageA: Math.round(averageA * 10) / 10,
    averageB: Math.round(averageB * 10) / 10,
    ...difference,
    favoringA: pool.filter((row) => row.advantage === "A").length,
    favoringB: pool.filter((row) => row.advantage === "B").length,
    close: pool.filter((row) => row.advantage === "even").length,
    strongestA: extreme(pool, (candidate, current) => candidate.scoreA > current.scoreA),
    strongestB: extreme(pool, (candidate, current) => candidate.scoreB > current.scoreB),
    closest: extreme(pool, (candidate, current) => candidate.magnitude < current.magnitude),
    largestGap: extreme(pool, (candidate, current) => candidate.magnitude > current.magnitude),
  };
}
