import { describe, expect, it } from "vitest";
import { evaluateQuarantine } from "./quarantine";
import { createQualityIssue } from "./qualityIssue";
import { buildNormalizedMatch } from "../testUtils/normalizedMatchFixture";

describe("evaluateQuarantine", () => {
  it("does not quarantine a clean, current-approved match", () => {
    const evaluation = evaluateQuarantine({ match: buildNormalizedMatch(), reconciliationCategory: "current-approved", issues: [] });
    expect(evaluation.quarantined).toBe(false);
  });

  it("quarantines a completed match with zero played maps", () => {
    const match = buildNormalizedMatch({ maps: [{ map: { name: "Ascent", raw: "Ascent", recognized: true }, order: 1, teamAScore: null, teamBScore: null, overtime: false, qualityFlags: [] }] });
    const evaluation = evaluateQuarantine({ match, reconciliationCategory: "current-approved", issues: [] });
    expect(evaluation.quarantined).toBe(true);
    expect(evaluation.reasons.some((r) => r.includes("zero played maps"))).toBe(true);
  });

  it("quarantines a match whose winner matches neither competing team", () => {
    const match = buildNormalizedMatch({ winnerId: "not-a-real-team" });
    const evaluation = evaluateQuarantine({ match, reconciliationCategory: "current-approved", issues: [] });
    expect(evaluation.quarantined).toBe(true);
  });

  it("quarantines a stale reconciliation category", () => {
    const evaluation = evaluateQuarantine({ match: buildNormalizedMatch(), reconciliationCategory: "stale", issues: [] });
    expect(evaluation.quarantined).toBe(true);
  });

  it("quarantines when a fatal-severity quality issue is present", () => {
    const issues = [createQualityIssue({ code: "invalid_score", entityType: "match", entityId: "vlr:match:1", message: "m", detectedAt: "t" })];
    const evaluation = evaluateQuarantine({ match: buildNormalizedMatch(), reconciliationCategory: "current-approved", issues });
    expect(evaluation.quarantined).toBe(true);
  });

  it("does not quarantine for a warning-only quality issue", () => {
    const issues = [createQualityIssue({ code: "unknown_map", entityType: "match", entityId: "vlr:match:1", message: "m", detectedAt: "t" })];
    const evaluation = evaluateQuarantine({ match: buildNormalizedMatch(), reconciliationCategory: "current-approved", issues });
    expect(evaluation.quarantined).toBe(false);
  });

  it("preserves the original record — quarantine is a classification, never a mutation of the match object", () => {
    const match = buildNormalizedMatch({ winnerId: "not-a-real-team" });
    const before = JSON.stringify(match);
    evaluateQuarantine({ match, reconciliationCategory: "current-approved", issues: [] });
    expect(JSON.stringify(match)).toBe(before);
  });
});
