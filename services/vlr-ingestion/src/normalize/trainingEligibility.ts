import { APPROVED_EVENT_FAMILIES } from "../classification/eventFamily";
import type { EventClassification } from "../classification/eventFamily";
import { isValidSeriesWinCount } from "./seriesFormat";
import type { SeriesFormat } from "./seriesFormat";

/**
 * Pure training-eligibility evaluator for TASK-042/TASK-043 — see
 * docs/29-vlr-data-ingestion-foundation.md ("Training-Eligibility Policy")
 * and TASK-041 requirement 8. Ineligible records are never deleted;
 * eligibility is a label on the normalized record, not a filter applied at
 * persistence time.
 */
export type MatchLifecycleStatus = "completed" | "upcoming" | "live" | "postponed" | "cancelled";

export type IneligibilityReason =
  | "not_completed"
  | "unknown_played_at"
  | "before_scope_start"
  | "after_scope_end"
  | "event_not_approved_family"
  | "missing_team_identity"
  | "winner_unknown"
  | "invalid_series_result"
  | "no_maps_played"
  | "cancelled"
  | "postponed"
  | "showmatch"
  | "duplicate"
  | "structurally_invalid";

export interface TrainingEligibilityInput {
  readonly status: MatchLifecycleStatus;
  /** Normalized ISO 8601 timestamp, or null if the source timestamp could not be normalized with confidence. */
  readonly playedAtIso: string | null;
  readonly scopeStartDate: string; // "YYYY-MM-DD"
  readonly scopeEndDate: string; // "YYYY-MM-DD"
  readonly eventClassification: EventClassification;
  readonly teamAId: string | null;
  readonly teamBId: string | null;
  readonly winnerId: string | null;
  readonly seriesFormat: SeriesFormat;
  readonly mapWinsForWinner: number;
  readonly mapsPlayedCount: number;
  readonly isDuplicate: boolean;
  readonly isShowmatch: boolean;
  readonly structurallyValid: boolean;
}

export interface TrainingEligibilityResult {
  readonly eligible: boolean;
  readonly reasons: readonly IneligibilityReason[];
}

const APPROVED_FAMILY_SET = new Set<string>(APPROVED_EVENT_FAMILIES);

export function evaluateTrainingEligibility(input: TrainingEligibilityInput): TrainingEligibilityResult {
  const reasons: IneligibilityReason[] = [];

  if (input.status === "cancelled") reasons.push("cancelled");
  if (input.status === "postponed") reasons.push("postponed");
  if (input.status !== "completed") reasons.push("not_completed");
  if (input.isShowmatch) reasons.push("showmatch");
  if (input.isDuplicate) reasons.push("duplicate");
  if (!input.structurallyValid) reasons.push("structurally_invalid");

  if (!input.playedAtIso) {
    reasons.push("unknown_played_at");
  } else {
    if (input.playedAtIso < `${input.scopeStartDate}T00:00:00.000Z`) reasons.push("before_scope_start");
    if (input.playedAtIso > `${input.scopeEndDate}T23:59:59.999Z`) reasons.push("after_scope_end");
  }

  if (!APPROVED_FAMILY_SET.has(input.eventClassification)) reasons.push("event_not_approved_family");
  if (!input.teamAId || !input.teamBId) reasons.push("missing_team_identity");
  if (!input.winnerId) reasons.push("winner_unknown");
  if (!isValidSeriesWinCount(input.seriesFormat, input.mapWinsForWinner)) reasons.push("invalid_series_result");
  if (input.mapsPlayedCount < 1) reasons.push("no_maps_played");

  return { eligible: reasons.length === 0, reasons };
}
