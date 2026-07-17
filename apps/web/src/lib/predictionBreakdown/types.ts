/**
 * TASK-037 Interactive Prediction Breakdown — shared pure types.
 *
 * Every type here is derived from the already-serialized `PredictionResult`
 * (`@repo/shared`, safe to import as a value client-side — it's a pure
 * types/constants package, not `@repo/prediction-engine`). Nothing here
 * changes, re-derives, or duplicates the prediction algorithm — these are
 * strictly presentation-layer view-models built from data the engine
 * already produced.
 */
import type { Advantage, DifferenceTier } from "../teamComparison";
import type { DnaDimensionKey, FactorImpact } from "@repo/shared";

export type { Advantage, DifferenceTier, DnaDimensionKey, FactorImpact };

/** Which side a contribution/dimension favors — "neutral" only for a zero-magnitude edge case, since `KeyFactor`s are always pre-filtered to a real edge. */
export type ContributionDirection = "A" | "B" | "neutral";

export interface ContributionRow {
  /** Equal to the source `KeyFactor.id`, which is itself a stable `DnaDimensionKey` string — safe to use as a React key and as the cross-highlight id. */
  id: string;
  label: string;
  description: string;
  direction: ContributionDirection;
  /** Unsigned, exactly `KeyFactor.magnitude` — untouched. */
  magnitude: number;
  /** Signed for chart rendering: positive extends toward Team A, negative toward Team B. */
  signedMagnitude: number;
  /** 0-100, this row's share of the total absolute magnitude across all rows. 0 when the total is 0. */
  shareOfTotal: number;
  /** 1-based rank by descending magnitude, alphabetical-by-label tie-break. */
  rank: number;
}

export interface DnaGapRow {
  key: DnaDimensionKey;
  label: string;
  valueA: number;
  valueB: number;
  advantage: Advantage;
  tier: DifferenceTier;
  magnitude: number;
}

export type PipelineAffect =
  | "validation"
  | "profile-resolution"
  | "match-dna"
  | "contribution-weighting"
  | "confidence"
  | "explanation-generation";

/**
 * The real `PipelineStage` contract has no status field — every stage the
 * engine returns already represents completed work. This type stays wide
 * (rather than a literal `"complete"`) so the view-model and its consumers
 * are correct if the data ever grows a real status field, but nothing in
 * this task fabricates a non-"complete" instance.
 */
export type PipelineStageStatus = "complete" | "skipped" | "error";

export interface PipelineStageView {
  id: string;
  label: string;
  description: string;
  durationMs: number;
  order: number;
  status: PipelineStageStatus;
  affects: PipelineAffect[];
}

export interface ExplanationFragment {
  text: string;
  /** Non-null only when this fragment deterministically references a specific dimension — see explanationLinks.ts. */
  linkedDimensionKey: DnaDimensionKey | null;
}
