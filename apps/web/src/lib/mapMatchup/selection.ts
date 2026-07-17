import type { GameMap } from "@repo/shared";
import type { MapComparisonRow } from "../teamComparison";

/** Toggles one map in/out of the selected pool. */
export function toggleMapSelection(selected: readonly string[], mapId: string): string[] {
  return selected.includes(mapId) ? selected.filter((id) => id !== mapId) : [...selected, mapId];
}

/** Every supported map's id, in the app's canonical map order. */
export function selectAllMaps(maps: readonly GameMap[]): string[] {
  return maps.map((map) => map.id);
}

/** An empty pool. */
export function clearMapSelection(): string[] {
  return [];
}

/**
 * Every map classified as close/even (`tier: "none"`) for this team pair —
 * the "Close Maps" shortcut. Deterministic and clearly scoped to the
 * documented threshold band, not a veto/pick-order concept.
 */
export function selectCloseMaps(rows: readonly MapComparisonRow[]): string[] {
  return rows.filter((row) => row.tier === "none").map((row) => row.mapId);
}
