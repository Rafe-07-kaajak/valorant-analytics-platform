import { describe, expect, it } from "vitest";
import { createEmptyVctProfileAdjustment } from "@repo/shared";
import { mapRealResponseToPredictionResult } from "./presentationAdapter";
import { simulateRealModel2 } from "./simulate";
import { buildFixtureResponse } from "./testFixtures";

describe("simulateRealModel2", () => {
  it("never changes the headline probability from a context-only axis delta", () => {
    const response = buildFixtureResponse();
    const baseline = mapRealResponseToPredictionResult(response, "Team A", "Team B", []);

    const teamAAdjustment = { ...createEmptyVctProfileAdjustment(), dna: { recentForm: 15 } };
    const teamBAdjustment = createEmptyVctProfileAdjustment();

    const simulation = simulateRealModel2(response, baseline, "Team A", "Team B", teamAAdjustment, teamBAdjustment, "req-sim-1");

    expect(simulation.result.outcomes).toEqual(baseline.outcomes);
    expect(simulation.result.predictedWinnerId).toBe(baseline.predictedWinnerId);
    // But the context-only change is still visible in the recomputed profile.
    const teamADna = simulation.result.teamDna.find((d) => d.teamId === response.teamAId)!;
    const baselineTeamADna = baseline.teamDna.find((d) => d.teamId === response.teamAId)!;
    expect(teamADna.dimensions.find((d) => d.key === "recentForm")!.value).toBeGreaterThan(
      baselineTeamADna.dimensions.find((d) => d.key === "recentForm")!.value,
    );
  });

  it("changes the headline probability from an eloStrength delta", () => {
    const response = buildFixtureResponse();
    const baseline = mapRealResponseToPredictionResult(response, "Team A", "Team B", []);

    const teamAAdjustment = { ...createEmptyVctProfileAdjustment(), dna: { eloStrength: 15 } };
    const teamBAdjustment = createEmptyVctProfileAdjustment();

    const simulation = simulateRealModel2(response, baseline, "Team A", "Team B", teamAAdjustment, teamBAdjustment, "req-sim-2");

    const baselineTeamAProbability = baseline.outcomes.find((o) => o.teamId === response.teamAId)!.winProbability;
    const simulatedTeamAProbability = simulation.result.outcomes.find((o) => o.teamId === response.teamAId)!.winProbability;
    expect(simulatedTeamAProbability).toBeGreaterThan(baselineTeamAProbability);
  });

  it("never mutates the baseline result", () => {
    const response = buildFixtureResponse();
    const baseline = mapRealResponseToPredictionResult(response, "Team A", "Team B", []);
    const baselineSnapshot = JSON.parse(JSON.stringify(baseline));

    const teamAAdjustment = { ...createEmptyVctProfileAdjustment(), dna: { eloStrength: 15, recentForm: -10 } };
    simulateRealModel2(response, baseline, "Team A", "Team B", teamAAdjustment, createEmptyVctProfileAdjustment(), "req-sim-3");

    expect(baseline).toEqual(baselineSnapshot);
  });

  it("is deterministic for identical adjustments", () => {
    const response = buildFixtureResponse();
    const baseline = mapRealResponseToPredictionResult(response, "Team A", "Team B", []);
    const teamAAdjustment = { ...createEmptyVctProfileAdjustment(), dna: { eloStrength: 8 } };

    const first = simulateRealModel2(response, baseline, "Team A", "Team B", teamAAdjustment, createEmptyVctProfileAdjustment(), "req-a");
    const second = simulateRealModel2(response, baseline, "Team A", "Team B", teamAAdjustment, createEmptyVctProfileAdjustment(), "req-a");

    expect(second.result.outcomes).toEqual(first.result.outcomes);
    expect(second.result.confidence).toBe(first.result.confidence);
  });

  it("keeps evidence trust (trustScore) unchanged by a hypothetical input tweak", () => {
    const response = buildFixtureResponse();
    const baseline = mapRealResponseToPredictionResult(response, "Team A", "Team B", []);
    const teamAAdjustment = { ...createEmptyVctProfileAdjustment(), dna: { eloStrength: 15 } };

    const simulation = simulateRealModel2(response, baseline, "Team A", "Team B", teamAAdjustment, createEmptyVctProfileAdjustment(), "req-sim-4");

    expect(simulation.result.trustScore).toBe(baseline.trustScore);
  });
});
