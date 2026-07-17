import type { GameMap } from "@repo/shared";
import type { MapComparisonRow, MapHighlight, VctTeamProfile } from "./types";
import { classifyDifference } from "./thresholds";

function mapName(mapId: string, maps: readonly GameMap[]): string {
  return maps.find((map) => map.id === mapId)?.name ?? mapId;
}

/**
 * Highest-scoring map in a profile's `mapStrength` record. This is a plain
 * min/max lookup over already-generated numbers, not a reimplementation of
 * TASK-031's map-strength formula — that generation logic stays exclusively
 * in `services/prediction-engine`.
 */
export function strongestMap(profile: VctTeamProfile, maps: readonly GameMap[]): MapHighlight | null {
  const entries = Object.entries(profile.mapStrength);
  if (entries.length === 0) return null;
  const [mapId, score] = entries.reduce((best, entry) => (entry[1] > best[1] ? entry : best));
  return { mapId, mapName: mapName(mapId, maps), score };
}

export function weakestMap(profile: VctTeamProfile, maps: readonly GameMap[]): MapHighlight | null {
  const entries = Object.entries(profile.mapStrength);
  if (entries.length === 0) return null;
  const [mapId, score] = entries.reduce((worst, entry) => (entry[1] < worst[1] ? entry : worst));
  return { mapId, mapName: mapName(mapId, maps), score };
}

/**
 * Per-map head-to-head rows for every map both profiles have a score for.
 * Deterministic and pure — memoize per selected team pair.
 */
export function compareMaps(
  profileA: VctTeamProfile,
  profileB: VctTeamProfile,
  maps: readonly GameMap[],
): MapComparisonRow[] {
  return maps
    .filter((map) => map.id in profileA.mapStrength && map.id in profileB.mapStrength)
    .map((map) => {
      const scoreA = profileA.mapStrength[map.id]!;
      const scoreB = profileB.mapStrength[map.id]!;
      const difference = classifyDifference(scoreA, scoreB);
      return { mapId: map.id, mapName: map.name, scoreA, scoreB, ...difference };
    });
}

/** The row with the smallest modeled gap — ties broken by map order. */
export function mostEvenMap(rows: readonly MapComparisonRow[]): MapComparisonRow | null {
  if (rows.length === 0) return null;
  return rows.reduce((best, row) => (row.magnitude < best.magnitude ? row : best));
}

/** The row with the largest modeled gap — ties broken by map order. */
export function largestGapMap(rows: readonly MapComparisonRow[]): MapComparisonRow | null {
  if (rows.length === 0) return null;
  return rows.reduce((best, row) => (row.magnitude > best.magnitude ? row : best));
}
