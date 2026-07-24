import type { SeriesFormat } from "@repo/shared";
import type { VctRegionId, VctTeamId } from "../../constants/vct";

/**
 * TASK-039's canonical cross-feature URL contract. Every route that
 * participates in cross-feature navigation (Prediction Studio, Team
 * Comparison Lab, Map Matchup Explorer) reads and writes a subset of this
 * same shape — see `CANONICAL_FIELD_ORDER` in `serialize.ts` for the
 * on-the-wire parameter names and their order.
 */
export interface CanonicalUrlState {
  regionA: VctRegionId | null;
  teamA: VctTeamId | null;
  regionB: VctRegionId | null;
  teamB: VctTeamId | null;
  /** Deduplicated, validated, canonically ordered (see `mapIds.ts`). */
  maps: string[];
  /** Only meaningful for Prediction Studio; other features never read or write it. */
  format: SeriesFormat | null;
  /** Only meaningful for Prediction Studio; other features never read or write it. `null` behaves as `"synthetic"` (today's only mode), mirroring `format`'s own null-default convention. */
  mode: ScenarioMode | null;
}

/** Prediction Studio's main-flow prediction source — real-model integration task. */
export type ScenarioMode = "synthetic" | "real";

export const EMPTY_CANONICAL_URL_STATE: CanonicalUrlState = Object.freeze({
  regionA: null,
  teamA: null,
  regionB: null,
  teamB: null,
  maps: [],
  format: null,
  mode: null,
}) as CanonicalUrlState;

export type CanonicalFieldKey = "regionA" | "teamA" | "regionB" | "teamB" | "maps" | "format" | "mode";

/** The three routes that participate in cross-feature navigation. The What-if Simulator is result-scoped, not a route, and is intentionally excluded. */
export type AnalyticsFeature = "prediction-studio" | "team-comparison" | "map-matchup";
