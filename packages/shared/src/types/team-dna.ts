/**
 * Synthetic Team DNA dimensions, unchanged from the original engine.
 * Real Model 2.0 (docs: Prediction Studio mode-unification task) never
 * populates these — no real equivalent exists for aggression/tempo/map
 * control/utility efficiency/adaptability/clutch ability, so faking one
 * would violate the truthfulness requirement. See `RealAxisKey` below for
 * Real Model 2.0's own, genuinely real, set of profile dimensions.
 */
export type SyntheticDnaDimensionKey =
  | "aggression"
  | "tempo"
  | "mapControl"
  | "utilityEfficiency"
  | "adaptability"
  | "clutchAbility";

/**
 * Real Model 2.0's profile dimensions — every one backed by a real ingested
 * feature (see `services/vlr-ingestion/src/feature/teamState.ts`), scaled to
 * the same 0-100 display range `TeamDna`/`DnaComparisonRadar` already use for
 * synthetic dimensions. `eloStrength` is the only one the deployed
 * `elo-baseline` estimator actually consumes; the rest are real supporting
 * context (see `docs` on `RealMatchContribution`/`RealSupportingContextFactor`
 * in `real-prediction.ts`).
 */
export type RealAxisKey =
  | "eloStrength"
  | "recentForm"
  | "opponentAdjustedStrength"
  | "mapPoolBreadth"
  | "scheduleStrength"
  | "activityRest"
  | "competitionExperience";

/**
 * The full set of dimension identifiers `TeamDna`/`DnaDimensionScore`/
 * `MatchDna` may carry — a synthetic result only ever uses
 * `SyntheticDnaDimensionKey` values, a Real Model 2.0 result only ever uses
 * `RealAxisKey` values, but the shared display/breakdown components
 * (`DnaComparisonRadar`, `MatchDnaSummary`, `TeamDnaCard`, the breakdown
 * tabs, the What-if Simulator) operate on this data purely generically (by
 * `key`/`label`/`value`, never by switching on which literal it is), so one
 * shared union lets those components serve both engines unmodified.
 */
export type DnaDimensionKey = SyntheticDnaDimensionKey | RealAxisKey;

export interface DnaDimensionScore {
  key: DnaDimensionKey;
  label: string;
  value: number;
}

export interface TeamDna {
  teamId: string;
  dimensions: DnaDimensionScore[];
}

export interface MatchDna {
  similarityScore: number;
  complementaryTraits: DnaDimensionKey[];
  conflictingTraits: DnaDimensionKey[];
  decisiveTrait: DnaDimensionKey;
}
