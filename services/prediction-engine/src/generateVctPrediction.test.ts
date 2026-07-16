import { describe, expect, it } from "vitest";
import type { PredictionRequest, Team } from "@repo/shared";
import { generateVctPrediction } from "./generateVctPrediction";
import { VCT_TEAM_IDENTITIES } from "./data/vctTeams";
import { VCT_PROFILE_DISCLOSURE } from "./lib/vctTeamProfiles";

function team(id: string, region: string): Team {
  return { id, name: id, region, logoUrl: `/assets/vct/teams/${region}/${id}.png` };
}

function request(teamAId: string, teamBId: string, overrides: Partial<PredictionRequest["scenario"]> = {}): PredictionRequest {
  return {
    requestId: crypto.randomUUID(),
    clientVersion: "web-0.1.0",
    timestamp: new Date().toISOString(),
    scenario: {
      teamAId,
      teamBId,
      seriesFormat: "BO3",
      mapIds: ["ascent", "haven", "bind"],
      ...overrides,
    },
  };
}

const paperRex = team("paper-rex", "pacific");
const g2 = team("g2-esports", "americas");

describe("generateVctPrediction", () => {
  it("returns a fully-shaped PredictionResult", () => {
    const result = generateVctPrediction(request("paper-rex", "g2-esports"), paperRex, g2);

    expect(result.outcomes).toHaveLength(2);
    expect(["paper-rex", "g2-esports"]).toContain(result.predictedWinnerId);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
    expect(result.trustScore).toBeGreaterThanOrEqual(0);
    expect(result.trustScore).toBeLessThanOrEqual(100);
    expect(result.teamDna).toHaveLength(2);
    expect(result.pipeline.length).toBeGreaterThan(0);
    expect(result.keyFactors).toBeInstanceOf(Array);
    expect(result.insights.length).toBeGreaterThan(0);
  });

  it("surfaces the simulated-data disclosure as a warning", () => {
    const result = generateVctPrediction(request("paper-rex", "g2-esports"), paperRex, g2);
    expect(result.warnings).toContain(VCT_PROFILE_DISCLOSURE);
  });

  it("does not claim coverage came from normalized match history", () => {
    const result = generateVctPrediction(request("paper-rex", "g2-esports"), paperRex, g2);
    const trustExplanation = result.insights.find((insight) => insight.id === "trust-score-explanation");
    expect(trustExplanation?.description).not.toContain("normalized match history");
  });

  it("produces the same analytical content for the same scenario (cache hit)", () => {
    const first = generateVctPrediction(request("paper-rex", "g2-esports"), paperRex, g2);
    const second = generateVctPrediction(request("paper-rex", "g2-esports"), paperRex, g2);

    expect(second.outcomes).toEqual(first.outcomes);
    expect(second.confidence).toBe(first.confidence);
    expect(second.teamDna).toEqual(first.teamDna);
    expect(second.requestId).not.toBe(first.requestId);
    expect(second.predictionId).not.toBe(first.predictionId);
  });

  it("throws when the resolved team identity does not match the scenario", () => {
    // A cache-key-unique map combo, so this doesn't hit an earlier test's cached entry.
    const mismatchedRequest = request("paper-rex", "g2-esports", { mapIds: ["lotus", "pearl"] });
    expect(() => generateVctPrediction(mismatchedRequest, g2, paperRex)).toThrow();
  });

  it("throws for an unknown team", () => {
    const unknown = team("not-a-real-team", "pacific");
    expect(() => generateVctPrediction(request("not-a-real-team", "g2-esports"), unknown, g2)).toThrow();
  });

  it("lets every one of the 32 VCT teams generate a prediction against a fixed opponent", () => {
    for (const identity of VCT_TEAM_IDENTITIES) {
      if (identity.id === "paper-rex") continue;
      const opponent = team(identity.id, identity.region);
      const result = generateVctPrediction(request("paper-rex", identity.id), paperRex, opponent);
      expect(Number.isFinite(result.confidence)).toBe(true);
      expect(Number.isFinite(result.trustScore)).toBe(true);
      expect([paperRex.id, identity.id]).toContain(result.predictedWinnerId);
    }
  });
});
