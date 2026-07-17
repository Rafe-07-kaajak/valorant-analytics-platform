import { describe, expect, it } from "vitest";
import type { PredictionResult } from "@repo/shared";
import { splitExplanationFragments } from "./explanationLinks";

function baseResult(overrides: Partial<PredictionResult> = {}): PredictionResult {
  return {
    predictionId: "p1",
    requestId: "r1",
    scenario: { teamAId: "paper-rex", teamBId: "g2-esports", seriesFormat: "BO3", mapIds: ["ascent"] },
    outcomes: [
      { teamId: "paper-rex", winProbability: 0.62 },
      { teamId: "g2-esports", winProbability: 0.38 },
    ],
    predictedWinnerId: "paper-rex",
    confidence: 70,
    trustScore: 80,
    explanation:
      "Paper Rex is favored primarily due to a aggression advantage over G2 Esports. Aggression shows the widest gap between these two teams and carries the most weight in this prediction.",
    teamDna: [
      {
        teamId: "paper-rex",
        dimensions: [
          { key: "aggression", label: "Aggression", value: 80 },
          { key: "tempo", label: "Tempo", value: 60 },
          { key: "mapControl", label: "Map Control", value: 60 },
          { key: "utilityEfficiency", label: "Utility Efficiency", value: 60 },
          { key: "adaptability", label: "Adaptability", value: 60 },
          { key: "clutchAbility", label: "Clutch Ability", value: 60 },
        ],
      },
      {
        teamId: "g2-esports",
        dimensions: [
          { key: "aggression", label: "Aggression", value: 55 },
          { key: "tempo", label: "Tempo", value: 60 },
          { key: "mapControl", label: "Map Control", value: 60 },
          { key: "utilityEfficiency", label: "Utility Efficiency", value: 60 },
          { key: "adaptability", label: "Adaptability", value: 60 },
          { key: "clutchAbility", label: "Clutch Ability", value: 60 },
        ],
      },
    ],
    matchDna: {
      similarityScore: 70,
      complementaryTraits: [],
      conflictingTraits: ["aggression"],
      decisiveTrait: "aggression",
    },
    keyFactors: [
      {
        id: "aggression",
        label: "Aggression",
        impact: "positive",
        magnitude: 25,
        description: "Paper Rex leads in aggression (80 vs 55 for G2 Esports).",
      },
    ],
    insights: [],
    pipeline: [],
    warnings: [],
    generatedAt: new Date().toISOString(),
    predictionVersion: "test",
    ...overrides,
  };
}

describe("splitExplanationFragments", () => {
  it("splits the explanation into sentences that rejoin to the exact original text", () => {
    const result = baseResult();
    const fragments = splitExplanationFragments(result);
    expect(fragments.map((fragment) => fragment.text).join(" ")).toBe(result.explanation);
  });

  it("links the first sentence to the top key factor's dimension", () => {
    const fragments = splitExplanationFragments(baseResult());
    expect(fragments[0]!.linkedDimensionKey).toBe("aggression");
  });

  it("links the second sentence to the decisive dimension", () => {
    const fragments = splitExplanationFragments(baseResult());
    expect(fragments[1]!.linkedDimensionKey).toBe("aggression");
  });

  it("leaves the fallback 'closely matched' sentence unlinked when there is no top factor", () => {
    const result = baseResult({
      keyFactors: [],
      explanation: "Paper Rex and G2 Esports are closely matched across every measured dimension, so this prediction leans on aggregate win probability alone.",
    });
    const fragments = splitExplanationFragments(result);
    expect(fragments).toHaveLength(1);
    expect(fragments[0]!.linkedDimensionKey).toBeNull();
  });

  it("does not crash and stays unlinked when a dimension label happens not to appear in the text", () => {
    const result = baseResult({ explanation: "A short unrelated sentence with no matches at all." });
    const fragments = splitExplanationFragments(result);
    expect(fragments[0]!.linkedDimensionKey).toBeNull();
  });

  it("is deterministic for the same input", () => {
    const result = baseResult();
    expect(splitExplanationFragments(result)).toEqual(splitExplanationFragments(result));
  });
});
