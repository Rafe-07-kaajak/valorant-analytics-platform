/**
 * TASK-035 Team Comparison Lab — shared pure types.
 *
 * `VctTeamProfile`/`VctArchetype` are imported with `import type` only, which
 * TypeScript erases entirely at compile time — no runtime code from
 * `@repo/prediction-engine` (and none of its Node-only modules) ever reaches
 * this module or anything that imports it, including client components.
 */
import type { VctTeamProfile } from "@repo/prediction-engine";

export type { VctTeamProfile };

/** Which side a comparison favors, or neither ("even") when the gap is too small to call. */
export type Advantage = "A" | "B" | "even";

/** How large a modeled difference is, per the documented bands in thresholds.ts. */
export type DifferenceTier = "none" | "slight" | "moderate" | "strong";

export interface DifferenceThresholds {
  slight: number;
  moderate: number;
  strong: number;
}

export interface DifferenceResult {
  advantage: Advantage;
  tier: DifferenceTier;
  /** Absolute difference between the two raw values, rounded to 1 decimal. */
  magnitude: number;
}

export interface ComparisonMetric extends DifferenceResult {
  key: string;
  label: string;
  valueA: number;
  valueB: number;
}

export interface MapHighlight {
  mapId: string;
  mapName: string;
  score: number;
}

export interface MapComparisonRow extends DifferenceResult {
  mapId: string;
  mapName: string;
  scoreA: number;
  scoreB: number;
}

export interface ComparisonFactor extends DifferenceResult {
  id: string;
  title: string;
  description: string;
}
