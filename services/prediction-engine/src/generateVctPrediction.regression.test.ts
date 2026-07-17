import { describe, expect, it } from "vitest";
import type { PredictionRequest, Team } from "@repo/shared";
import { generateVctPrediction } from "./generateVctPrediction";

/**
 * TASK-037 hard regression guard. TASK-037 only adds a client-side
 * interactive presentation layer on top of `PredictionResult` — it must not
 * change a single analytical value the engine produces. This test pins the
 * exact output for a fixed scenario (captured before any TASK-037 work
 * began) so any future accidental change to the prediction algorithm,
 * Team DNA generation, key-factor selection, or explanation text fails
 * loudly here, independent of the broader (looser) assertions in
 * `generateVctPrediction.test.ts`.
 *
 * `predictionId`, `requestId`, `generatedAt`, and each `pipeline[].durationMs`
 * are intentionally excluded — those are expected to vary per request (fresh
 * uuid/timestamp/seeded pipeline timing on every call) even for the
 * identical scenario, per the cache behavior documented in
 * `generateVctPrediction.ts`.
 */

function team(id: string, region: string): Team {
  return { id, name: id, region, logoUrl: "/x.png" };
}

const paperRex = team("paper-rex", "pacific");
const g2 = team("g2-esports", "americas");

const request: PredictionRequest = {
  requestId: "fixed-regression-request-id",
  clientVersion: "web-0.1.0",
  timestamp: "2026-01-01T00:00:00.000Z",
  scenario: { teamAId: "paper-rex", teamBId: "g2-esports", seriesFormat: "BO3", mapIds: ["ascent", "haven", "bind"] },
};

describe("generateVctPrediction — TASK-037 output regression guard", () => {
  it("returns byte-equivalent analytical fields for the pinned scenario", () => {
    const result = generateVctPrediction(request, paperRex, g2);

    expect(result.outcomes).toEqual([
      { teamId: "paper-rex", winProbability: 0.29 },
      { teamId: "g2-esports", winProbability: 0.71 },
    ]);
    expect(result.predictedWinnerId).toBe("g2-esports");
    expect(result.confidence).toBe(79);
    expect(result.trustScore).toBe(90);
    expect(result.explanation).toBe(
      "g2-esports is favored primarily due to a clutch ability advantage over paper-rex. Clutch Ability shows the widest gap between these two teams and carries the most weight in this prediction.",
    );

    expect(result.teamDna).toEqual([
      {
        teamId: "paper-rex",
        dimensions: [
          { key: "aggression", label: "Aggression", value: 0 },
          { key: "tempo", label: "Tempo", value: 30 },
          { key: "mapControl", label: "Map Control", value: 80 },
          { key: "utilityEfficiency", label: "Utility Efficiency", value: 29 },
          { key: "adaptability", label: "Adaptability", value: 72 },
          { key: "clutchAbility", label: "Clutch Ability", value: 10 },
        ],
      },
      {
        teamId: "g2-esports",
        dimensions: [
          { key: "aggression", label: "Aggression", value: 15 },
          { key: "tempo", label: "Tempo", value: 93 },
          { key: "mapControl", label: "Map Control", value: 66 },
          { key: "utilityEfficiency", label: "Utility Efficiency", value: 91 },
          { key: "adaptability", label: "Adaptability", value: 10 },
          { key: "clutchAbility", label: "Clutch Ability", value: 80 },
        ],
      },
    ]);

    expect(result.matchDna).toEqual({
      similarityScore: 33,
      complementaryTraits: [],
      conflictingTraits: ["clutchAbility", "tempo", "utilityEfficiency", "adaptability"],
      decisiveTrait: "clutchAbility",
    });

    expect(result.keyFactors).toEqual([
      {
        id: "clutchAbility",
        label: "Clutch Ability",
        impact: "positive",
        magnitude: 70,
        description: "g2-esports leads in clutch ability (80 vs 10 for paper-rex).",
      },
      {
        id: "tempo",
        label: "Tempo",
        impact: "positive",
        magnitude: 63,
        description: "g2-esports leads in tempo (93 vs 30 for paper-rex).",
      },
      {
        id: "utilityEfficiency",
        label: "Utility Efficiency",
        impact: "positive",
        magnitude: 62,
        description: "g2-esports leads in utility efficiency (91 vs 29 for paper-rex).",
      },
      {
        id: "adaptability",
        label: "Adaptability",
        impact: "negative",
        magnitude: 62,
        description: "paper-rex leads in adaptability (72 vs 10 for g2-esports).",
      },
    ]);

    expect(result.insights.map((insight) => ({ id: insight.id, description: insight.description }))).toEqual([
      { id: "strongest-advantage", description: "g2-esports leads in clutch ability (80 vs 10 for paper-rex)." },
      { id: "biggest-weakness", description: "paper-rex leads in adaptability (72 vs 10 for g2-esports)." },
      {
        id: "deciding-factor",
        description: "Clutch Ability shows the widest gap between these two teams and carries the most weight in this prediction.",
      },
      {
        id: "confidence-explanation",
        description:
          "Confidence sits at 79% because 67% of measured Team DNA dimensions agree with g2-esports, and recent form is 97% consistent with each team's overall win rate.",
      },
      {
        id: "trust-score-explanation",
        description:
          "Trust Score sits at 90% because both teams have complete modeled Team DNA coverage, combined with this prediction's 79% confidence.",
      },
    ]);

    expect(result.pipeline.map((stage) => stage.id)).toEqual([
      "match-request",
      "load-data",
      "validation",
      "feature-extraction",
      "team-dna",
      "match-dna",
      "prediction",
      "confidence-estimation",
      "explanation-generation",
    ]);

    expect(result.warnings).toEqual([
      "Predictions use simulated team profiles for demonstration purposes. Values are modeled estimates, not real statistics from Riot Games or any tournament.",
    ]);
  });
});
