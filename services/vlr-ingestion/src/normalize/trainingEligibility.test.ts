import { describe, expect, it } from "vitest";
import { evaluateTrainingEligibility } from "./trainingEligibility";
import type { TrainingEligibilityInput } from "./trainingEligibility";

function eligibleInput(overrides: Partial<TrainingEligibilityInput> = {}): TrainingEligibilityInput {
  return {
    status: "completed",
    playedAtIso: "2025-06-01T00:00:00.000Z",
    scopeStartDate: "2025-01-01",
    scopeEndDate: "2026-07-18",
    eventClassification: "vct-americas",
    teamAId: "fnatic",
    teamBId: "team-liquid",
    winnerId: "fnatic",
    seriesFormat: "bo3",
    mapWinsForWinner: 2,
    mapsPlayedCount: 2,
    isDuplicate: false,
    isShowmatch: false,
    structurallyValid: true,
    ...overrides,
  };
}

describe("evaluateTrainingEligibility — eligible path", () => {
  it("is eligible when every rule passes", () => {
    expect(evaluateTrainingEligibility(eligibleInput())).toEqual({ eligible: true, reasons: [] });
  });

  it("is eligible for each of the six approved event families", () => {
    for (const family of ["vct-americas", "vct-emea", "vct-pacific", "vct-china", "masters", "champions"] as const) {
      expect(evaluateTrainingEligibility(eligibleInput({ eventClassification: family })).eligible).toBe(true);
    }
  });
});

describe("evaluateTrainingEligibility — ineligibility reasons", () => {
  it("rejects a non-completed match", () => {
    const result = evaluateTrainingEligibility(eligibleInput({ status: "live" }));
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("not_completed");
  });

  it("rejects a match before the scope start date", () => {
    const result = evaluateTrainingEligibility(eligibleInput({ playedAtIso: "2024-12-31T23:59:59.999Z" }));
    expect(result.reasons).toContain("before_scope_start");
  });

  it("rejects a match after the scope end date", () => {
    const result = evaluateTrainingEligibility(eligibleInput({ playedAtIso: "2026-07-19T00:00:00.000Z" }));
    expect(result.reasons).toContain("after_scope_end");
  });

  it("rejects an unknown/unnormalized playedAt", () => {
    const result = evaluateTrainingEligibility(eligibleInput({ playedAtIso: null }));
    expect(result.reasons).toContain("unknown_played_at");
  });

  it("rejects an event classification outside the six approved families", () => {
    const result = evaluateTrainingEligibility(eligibleInput({ eventClassification: "unknown" }));
    expect(result.reasons).toContain("event_not_approved_family");
  });

  it("rejects an excluded-category event classification", () => {
    const result = evaluateTrainingEligibility(eligibleInput({ eventClassification: "excluded-game-changers" }));
    expect(result.reasons).toContain("event_not_approved_family");
  });

  it("rejects a match missing a team identity", () => {
    const result = evaluateTrainingEligibility(eligibleInput({ teamBId: null }));
    expect(result.reasons).toContain("missing_team_identity");
  });

  it("rejects a match with an unknown winner", () => {
    const result = evaluateTrainingEligibility(eligibleInput({ winnerId: null }));
    expect(result.reasons).toContain("winner_unknown");
  });

  it("rejects an invalid series result (map wins don't clinch the format)", () => {
    const result = evaluateTrainingEligibility(eligibleInput({ seriesFormat: "bo3", mapWinsForWinner: 1 }));
    expect(result.reasons).toContain("invalid_series_result");
  });

  it("rejects a match with zero maps played", () => {
    const result = evaluateTrainingEligibility(eligibleInput({ mapsPlayedCount: 0 }));
    expect(result.reasons).toContain("no_maps_played");
  });

  it("rejects a cancelled match", () => {
    const result = evaluateTrainingEligibility(eligibleInput({ status: "cancelled" }));
    expect(result.reasons).toContain("cancelled");
  });

  it("rejects a postponed match", () => {
    const result = evaluateTrainingEligibility(eligibleInput({ status: "postponed" }));
    expect(result.reasons).toContain("postponed");
  });

  it("rejects a showmatch", () => {
    const result = evaluateTrainingEligibility(eligibleInput({ isShowmatch: true }));
    expect(result.reasons).toContain("showmatch");
  });

  it("rejects a duplicate record", () => {
    const result = evaluateTrainingEligibility(eligibleInput({ isDuplicate: true }));
    expect(result.reasons).toContain("duplicate");
  });

  it("rejects a structurally invalid record", () => {
    const result = evaluateTrainingEligibility(eligibleInput({ structurallyValid: false }));
    expect(result.reasons).toContain("structurally_invalid");
  });

  it("accumulates multiple independent reasons at once", () => {
    const result = evaluateTrainingEligibility(eligibleInput({ status: "cancelled", winnerId: null, teamAId: null }));
    expect(result.reasons).toEqual(expect.arrayContaining(["cancelled", "not_completed", "winner_unknown", "missing_team_identity"]));
  });
});
