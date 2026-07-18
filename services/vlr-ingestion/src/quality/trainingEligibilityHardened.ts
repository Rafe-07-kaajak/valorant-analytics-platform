import type { NormalizedMatch } from "../normalize/normalizedSchemas";
import type { ReconciliationCategory } from "../reconciliation/reconciliationTypes";
import { computeRosterCompletenessScore } from "./rosterQuality";

/**
 * Training-eligibility hardening — TASK-043 requirement 17. Wraps (never
 * replaces) TASK-042's preliminary per-record `trainingEligibility`
 * (`normalize/trainingEligibility.ts`, computed at normalization time from
 * record-local facts only — left completely unchanged). This adds the
 * dataset-wide gates that only exist once reconciliation and quarantine
 * have run: current-manifest membership, quarantine status, and identity
 * confidence — without re-requiring anything TASK-042 already decided not
 * to require (full 32-team mapping, complete rosters, attack/defense
 * splits, a known patch).
 */
export type HardenedIneligibilityReason =
  | "preliminary_ineligible"
  | "quarantined"
  | "not_current_approved_manifest_member"
  | "unstable_team_identity";

export interface HardenedEligibilityInput {
  readonly match: NormalizedMatch;
  readonly reconciliationCategory: ReconciliationCategory | undefined;
  readonly quarantined: boolean;
}

export interface IdentityConfidenceSummary {
  readonly teamAMapped: boolean;
  readonly teamBMapped: boolean;
  readonly bothStable: boolean;
}

export interface RosterCompletenessSummary {
  readonly score: number;
  readonly bothTeamsPresent: boolean;
}

export interface HardenedEligibilityResult {
  readonly eligible: boolean;
  readonly reasons: readonly HardenedIneligibilityReason[];
  readonly warnings: readonly string[];
  readonly identityConfidence: IdentityConfidenceSummary;
  readonly rosterCompleteness: RosterCompletenessSummary;
}

/** A "stable provider identity" only requires a non-empty external VLR ID on both sides — internal-registry mapping is explicitly NOT required (requirement 17: "do not require all teams to map to the current UI's 32 internal teams"). */
function hasStableTeamIdentities(match: NormalizedMatch): boolean {
  return Boolean(match.teamAId && match.teamBId);
}

export function evaluateHardenedTrainingEligibility(input: HardenedEligibilityInput): HardenedEligibilityResult {
  const { match, reconciliationCategory, quarantined } = input;
  const reasons: HardenedIneligibilityReason[] = [];
  const warnings: string[] = [];

  if (!match.trainingEligibility.eligible) reasons.push("preliminary_ineligible");
  if (quarantined) reasons.push("quarantined");
  if (reconciliationCategory !== undefined && reconciliationCategory !== "current-approved") reasons.push("not_current_approved_manifest_member");
  if (!hasStableTeamIdentities(match)) reasons.push("unstable_team_identity");

  if (match.teamAId.startsWith("vlr:team:")) warnings.push(`Team A ("${match.teamAId}") has no verified internal mapping.`);
  if (match.teamBId.startsWith("vlr:team:")) warnings.push(`Team B ("${match.teamBId}") has no verified internal mapping.`);

  const rosterScore = computeRosterCompletenessScore(match);
  if (rosterScore.score < 1) warnings.push(`Roster completeness score ${rosterScore.score.toFixed(2)} (< 1.0) — not a blocking condition.`);

  return {
    eligible: reasons.length === 0,
    reasons,
    warnings,
    identityConfidence: { teamAMapped: !match.teamAId.startsWith("vlr:team:"), teamBMapped: !match.teamBId.startsWith("vlr:team:"), bothStable: hasStableTeamIdentities(match) },
    rosterCompleteness: { score: rosterScore.score, bothTeamsPresent: rosterScore.teamScores.size === 2 },
  };
}
