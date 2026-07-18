import { describe, expect, it } from "vitest";
import { evaluateHardenedTrainingEligibility } from "./trainingEligibilityHardened";
import { buildNormalizedMatch } from "../testUtils/normalizedMatchFixture";

describe("evaluateHardenedTrainingEligibility", () => {
  it("is eligible for a clean, current-approved, non-quarantined, preliminarily-eligible match", () => {
    const result = evaluateHardenedTrainingEligibility({ match: buildNormalizedMatch(), reconciliationCategory: "current-approved", quarantined: false });
    expect(result.eligible).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it("is ineligible when quarantined, even if the preliminary evaluator said eligible", () => {
    const result = evaluateHardenedTrainingEligibility({ match: buildNormalizedMatch(), reconciliationCategory: "current-approved", quarantined: true });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("quarantined");
  });

  it("is ineligible when the match is not a current-approved manifest member", () => {
    const result = evaluateHardenedTrainingEligibility({ match: buildNormalizedMatch(), reconciliationCategory: "stale", quarantined: false });
    expect(result.reasons).toContain("not_current_approved_manifest_member");
  });

  it("does not require full internal-team-registry mapping — an unmapped-but-stable team ID stays eligible", () => {
    const match = buildNormalizedMatch({ teamAId: "vlr:team:9999" });
    const result = evaluateHardenedTrainingEligibility({ match, reconciliationCategory: "current-approved", quarantined: false });
    expect(result.eligible).toBe(true);
    expect(result.identityConfidence.teamAMapped).toBe(false);
    expect(result.warnings.some((w) => w.includes("no verified internal mapping"))).toBe(true);
  });

  it("does not require a complete roster — an incomplete roster is a warning, not a blocking reason", () => {
    const match = buildNormalizedMatch({ rosterSnapshots: [{ teamInternalId: "fnatic", asOf: "t", playerInternalIds: ["vlr:player:1"] }] });
    const result = evaluateHardenedTrainingEligibility({ match, reconciliationCategory: "current-approved", quarantined: false });
    expect(result.eligible).toBe(true);
    expect(result.rosterCompleteness.score).toBeLessThan(1);
  });

  it("propagates the preliminary (TASK-042) ineligibility reason without duplicating its logic", () => {
    const match = buildNormalizedMatch({ trainingEligibility: { eligible: false, reasons: ["winner_unknown"] } });
    const result = evaluateHardenedTrainingEligibility({ match, reconciliationCategory: "current-approved", quarantined: false });
    expect(result.reasons).toContain("preliminary_ineligible");
  });
});
