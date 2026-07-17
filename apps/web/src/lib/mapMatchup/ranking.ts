import type { MapComparisonRow } from "../teamComparison";
import type { MapRankingRow, SortMode } from "./types";

/**
 * Ranks every map row deterministically for the given sort mode. Every
 * comparator ends in an alphabetical-by-map-name tie-breaker, so ordering
 * never depends on input array order or any hidden randomness — the same
 * rows always produce the same order. Pool-selection state is attached to
 * each row for display but never participates in the sort key, so toggling
 * the pool never reorders the ranking (per requirement 6) unless the caller
 * explicitly picks a sort mode that reads selection — none currently do.
 */
export function rankMaps(
  rows: readonly MapComparisonRow[],
  selectedMapIds: readonly string[],
  sortMode: SortMode,
): MapRankingRow[] {
  const withSelection: MapRankingRow[] = rows.map((row) => ({
    ...row,
    selected: selectedMapIds.includes(row.mapId),
  }));

  const byName = (a: MapRankingRow, b: MapRankingRow) => a.mapName.localeCompare(b.mapName);

  const comparator: Record<SortMode, (a: MapRankingRow, b: MapRankingRow) => number> = {
    "largest-gap": (a, b) => b.magnitude - a.magnitude || byName(a, b),
    closest: (a, b) => a.magnitude - b.magnitude || byName(a, b),
    "map-name": byName,
    "team-a-strength": (a, b) => b.scoreA - a.scoreA || byName(a, b),
    "team-b-strength": (a, b) => b.scoreB - a.scoreB || byName(a, b),
  };

  return [...withSelection].sort(comparator[sortMode]);
}

/**
 * Resolves which map the Map Detail view should show: the requested id if
 * it's still present in the current ranking, otherwise the first ranked
 * row as a safe fallback (covers both "nothing chosen yet" and "the
 * previously active map disappeared from the data"), otherwise null when
 * there's nothing to show at all.
 */
export function resolveActiveMap(
  rankedRows: readonly MapRankingRow[],
  activeMapId: string | null,
): MapRankingRow | null {
  if (activeMapId) {
    const found = rankedRows.find((row) => row.mapId === activeMapId);
    if (found) return found;
  }
  return rankedRows[0] ?? null;
}
