import { describe, expect, it } from "vitest";
import { detectDuplicateMatchCandidates } from "./duplicateDetection";
import { buildNormalizedMatch } from "../testUtils/normalizedMatchFixture";

describe("detectDuplicateMatchCandidates", () => {
  it("produces no candidates when every team pair appears at most once", () => {
    const matches = [buildNormalizedMatch({ internalId: "vlr:match:1" }), buildNormalizedMatch({ internalId: "vlr:match:2", teamAId: "nrg", teamBId: "100-thieves" })];
    expect(detectDuplicateMatchCandidates(matches)).toHaveLength(0);
  });

  it("classifies two same-day, same-event, same-format, same-map-sequence records as a cross-event-listing-duplicate", () => {
    const matches = [
      buildNormalizedMatch({ internalId: "vlr:match:1" }),
      buildNormalizedMatch({ internalId: "vlr:match:2" }),
    ];
    const [candidate] = detectDuplicateMatchCandidates(matches);
    expect(candidate).toMatchObject({ classification: "cross-event-listing-duplicate", confidence: "high" });
  });

  it("never merges two distinct match IDs — only ever reports a classification, both original IDs remain distinct", () => {
    const matches = [buildNormalizedMatch({ internalId: "vlr:match:1" }), buildNormalizedMatch({ internalId: "vlr:match:2" })];
    const [candidate] = detectDuplicateMatchCandidates(matches);
    expect(candidate!.matchA).not.toBe(candidate!.matchB);
  });

  it("classifies a same-team-pair match on a different day, in a different event, with a different map sequence as a rematch, not a duplicate", () => {
    const matches = [
      buildNormalizedMatch({ internalId: "vlr:match:1", eventId: "vlr:event:1", scheduledAt: { iso: "2025-01-01T00:00:00.000Z", raw: "r", confidence: "high" } }),
      buildNormalizedMatch({
        internalId: "vlr:match:2",
        eventId: "vlr:event:2",
        scheduledAt: { iso: "2025-06-01T00:00:00.000Z", raw: "r", confidence: "high" },
        maps: [{ map: { name: "Haven", raw: "Haven", recognized: true }, order: 1, teamAScore: 13, teamBScore: 3, overtime: false, qualityFlags: [] }],
      }),
    ];
    const [candidate] = detectDuplicateMatchCandidates(matches);
    expect(candidate!.classification).toBe("rematch-not-duplicate");
  });

  it("classifies a same-day, same-format, same-map-sequence pair under different events as a semantic-duplicate-candidate (review only)", () => {
    const matches = [
      buildNormalizedMatch({ internalId: "vlr:match:1", eventId: "vlr:event:1" }),
      buildNormalizedMatch({ internalId: "vlr:match:2", eventId: "vlr:event:2" }),
    ];
    const [candidate] = detectDuplicateMatchCandidates(matches);
    expect(candidate).toMatchObject({ classification: "semantic-duplicate-candidate", confidence: "low" });
  });
});
