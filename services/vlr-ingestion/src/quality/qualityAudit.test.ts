import { describe, expect, it } from "vitest";
import { runQualityAudit } from "./qualityAudit";
import { buildNormalizedMatch } from "../testUtils/normalizedMatchFixture";

describe("runQualityAudit", () => {
  it("produces a deterministic, sorted issue list and a match-audit summary for clean matches", () => {
    const result = runQualityAudit([buildNormalizedMatch()], new Map(), "2025-01-01", "2026-12-31", "t");
    expect(result.matchAudit.totalMatches).toBe(1);
    expect(result.matchAudit.missingWinnerCount).toBe(0);
  });

  it("counts a completed match with zero played maps", () => {
    const match = buildNormalizedMatch({ maps: [{ map: { name: "Ascent", raw: "Ascent", recognized: true }, order: 1, teamAScore: null, teamBScore: null, overtime: false, qualityFlags: [] }] });
    const result = runQualityAudit([match], new Map(), "2025-01-01", "2026-12-31", "t");
    expect(result.matchAudit.zeroPlayedMapsCount).toBe(1);
  });

  it("surfaces semantic duplicate candidates as quality issues, never merging the underlying matches", () => {
    const matches = [buildNormalizedMatch({ internalId: "vlr:match:1" }), buildNormalizedMatch({ internalId: "vlr:match:2" })];
    const result = runQualityAudit(matches, new Map(), "2025-01-01", "2026-12-31", "t");
    expect(result.issues.some((i) => i.code === "semantic_duplicate_candidate")).toBe(true);
    expect(result.duplicateCandidates).toHaveLength(1);
  });

  it("returns the exact same issue ordering across repeated calls with the same input", () => {
    const matches = [buildNormalizedMatch({ internalId: "vlr:match:2" }), buildNormalizedMatch({ internalId: "vlr:match:1" })];
    const first = runQualityAudit(matches, new Map(), "2025-01-01", "2026-12-31", "t");
    const second = runQualityAudit(matches, new Map(), "2025-01-01", "2026-12-31", "t");
    expect(first.issues.map((i) => `${i.code}:${i.entityId}`)).toEqual(second.issues.map((i) => `${i.code}:${i.entityId}`));
  });
});
