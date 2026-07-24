import { describe, expect, it } from "vitest";
import { mapRealResponseToPredictionResult } from "./presentationAdapter";
import { buildFixtureResponse } from "./testFixtures";

describe("mapRealResponseToPredictionResult", () => {
  it("maps real outcomes, confidence, and trust score onto the PredictionResult contract", () => {
    const response = buildFixtureResponse();
    const result = mapRealResponseToPredictionResult(response, "Team A", "Team B", ["ascent", "haven"]);

    expect(result.outcomes).toEqual([
      { teamId: "team-a", winProbability: response.teamAWinProbability },
      { teamId: "team-b", winProbability: response.teamBWinProbability },
    ]);
    expect(result.predictedWinnerId).toBe("team-a");
    expect(result.confidence).toBe(Math.round(response.confidence * 100));
    expect(result.trustScore).toBe(78);
    expect(result.scenario).toEqual({ teamAId: "team-a", teamBId: "team-b", seriesFormat: "BO3", mapIds: ["ascent", "haven"] });
    expect(result.predictionVersion).toBe("fixture-model-v1");
  });

  it("never uses synthetic Team DNA vocabulary for its dimension keys", () => {
    const response = buildFixtureResponse();
    const result = mapRealResponseToPredictionResult(response, "Team A", "Team B", []);
    const syntheticKeys = ["aggression", "tempo", "mapControl", "utilityEfficiency", "adaptability", "clutchAbility"];

    for (const teamDna of result.teamDna) {
      for (const dimension of teamDna.dimensions) {
        expect(syntheticKeys).not.toContain(dimension.key);
      }
    }
    expect(syntheticKeys).not.toContain(result.matchDna.decisiveTrait);
  });

  it("names Elo as the decisive trait and the sole model-driver key factor", () => {
    const response = buildFixtureResponse();
    const result = mapRealResponseToPredictionResult(response, "Team A", "Team B", []);

    expect(result.matchDna.decisiveTrait).toBe("eloStrength");
    const driverFactor = result.keyFactors.find((f) => f.id === "eloStrength");
    expect(driverFactor).toBeDefined();
    expect(driverFactor!.description).toContain("only real signal");
  });

  it("every non-driver key factor explicitly states it is context only", () => {
    const response = buildFixtureResponse();
    const result = mapRealResponseToPredictionResult(response, "Team A", "Team B", []);
    const contextFactors = result.keyFactors.filter((f) => f.id !== "eloStrength");

    expect(contextFactors.length).toBeGreaterThan(0);
    for (const factor of contextFactors) {
      expect(factor.description.toLowerCase()).toContain("context only");
    }
  });

  it("produces insight ids PredictionSummary's tooltip lookups depend on", () => {
    const response = buildFixtureResponse();
    const result = mapRealResponseToPredictionResult(response, "Team A", "Team B", []);
    const ids = result.insights.map((i) => i.id);

    expect(ids).toContain("confidence-explanation");
    expect(ids).toContain("trust-score-explanation");
  });

  it("preserves null pipeline stage durations rather than fabricating a number", () => {
    const response = buildFixtureResponse();
    const result = mapRealResponseToPredictionResult(response, "Team A", "Team B", []);
    const unmeasured = result.pipeline.filter((stage) => stage.durationMs === null);
    const measured = result.pipeline.filter((stage) => stage.durationMs !== null);

    expect(unmeasured.length).toBeGreaterThan(0);
    expect(measured).toHaveLength(1);
  });

  it("is deterministic: identical input produces an identical result", () => {
    const response = buildFixtureResponse();
    const first = mapRealResponseToPredictionResult(response, "Team A", "Team B", ["ascent"]);
    const second = mapRealResponseToPredictionResult(response, "Team A", "Team B", ["ascent"]);
    expect(second).toEqual(first);
  });
});
