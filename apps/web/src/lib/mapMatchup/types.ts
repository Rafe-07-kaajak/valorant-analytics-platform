/**
 * TASK-036 Map Matchup Explorer — shared pure types. Reuses TASK-035's
 * `teamComparison` primitives (Advantage, DifferenceTier, MapComparisonRow,
 * classifyDifference, compareMaps, ...) rather than duplicating them — this
 * module only adds concepts specific to map-matchup exploration (ranking,
 * pool aggregation, sort modes).
 */
import type { Advantage, DifferenceTier, MapComparisonRow } from "../teamComparison";

export type {
  Advantage,
  DifferenceTier,
  MapComparisonRow,
  MapHighlight,
  VctTeamProfile,
} from "../teamComparison";

export type SortMode = "largest-gap" | "closest" | "map-name" | "team-a-strength" | "team-b-strength";

export interface SortModeDefinition {
  id: SortMode;
  label: string;
}

export const SORT_MODES: readonly SortModeDefinition[] = [
  { id: "largest-gap", label: "Largest Gap" },
  { id: "closest", label: "Closest Matchup" },
  { id: "map-name", label: "Map Name" },
  { id: "team-a-strength", label: "Team A Strength" },
  { id: "team-b-strength", label: "Team B Strength" },
];

export interface MapRankingRow extends MapComparisonRow {
  /** Whether this map is currently included in the selected pool. */
  selected: boolean;
}

export interface PoolAggregate {
  mapCount: number;
  averageA: number;
  averageB: number;
  advantage: Advantage;
  tier: DifferenceTier;
  magnitude: number;
  favoringA: number;
  favoringB: number;
  close: number;
  strongestA: MapComparisonRow | null;
  strongestB: MapComparisonRow | null;
  closest: MapComparisonRow | null;
  largestGap: MapComparisonRow | null;
}
