/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SimulationResult } from "@repo/shared";
import { useSimulatorState } from "./useSimulatorState";

function fakeResult(): SimulationResult {
  return {
    simulationId: "s1",
    requestId: "r1",
    teamAAdjustment: { scalar: {}, dna: { aggression: 5 }, mapStrength: {} },
    teamBAdjustment: { scalar: {}, dna: {}, mapStrength: {} },
    generatedAt: new Date().toISOString(),
    result: {
      predictionId: "p1",
      requestId: "r1",
      scenario: { teamAId: "paper-rex", teamBId: "g2-esports", seriesFormat: "BO3", mapIds: ["ascent"] },
      outcomes: [
        { teamId: "paper-rex", winProbability: 0.65 },
        { teamId: "g2-esports", winProbability: 0.35 },
      ],
      predictedWinnerId: "paper-rex",
      confidence: 72,
      trustScore: 81,
      explanation: "x",
      teamDna: [
        { teamId: "paper-rex", dimensions: [] },
        { teamId: "g2-esports", dimensions: [] },
      ],
      matchDna: { similarityScore: 70, complementaryTraits: [], conflictingTraits: [], decisiveTrait: "aggression" },
      keyFactors: [],
      insights: [],
      pipeline: [],
      warnings: [],
      generatedAt: new Date().toISOString(),
      predictionVersion: "test",
    },
  };
}

describe("useSimulatorState", () => {
  it("starts idle with zeroed drafts and no adjustments", () => {
    const { result } = renderHook(() => useSimulatorState(["ascent", "haven"]));
    expect(result.current.status).toBe("idle");
    expect(result.current.hasAdjustments).toBe(false);
    expect(result.current.mapADraft).toEqual({ ascent: 0, haven: 0 });
  });

  it("setAttribute updates only the targeted side and key", () => {
    const { result } = renderHook(() => useSimulatorState(["ascent"]));
    act(() => result.current.setAttribute("A", "aggression", 8));
    expect(result.current.teamADraft.aggression).toBe(8);
    expect(result.current.teamBDraft.aggression).toBe(0);
    expect(result.current.hasAdjustments).toBe(true);
  });

  it("resetAttribute clears one field without touching others", () => {
    const { result } = renderHook(() => useSimulatorState(["ascent"]));
    act(() => result.current.setAttribute("A", "aggression", 8));
    act(() => result.current.setAttribute("A", "tempo", 4));
    act(() => result.current.resetAttribute("A", "aggression"));
    expect(result.current.teamADraft.aggression).toBe(0);
    expect(result.current.teamADraft.tempo).toBe(4);
  });

  it("setMap / resetMap target one map id", () => {
    const { result } = renderHook(() => useSimulatorState(["ascent", "haven"]));
    act(() => result.current.setMap("B", "ascent", 5));
    expect(result.current.mapBDraft.ascent).toBe(5);
    expect(result.current.mapBDraft.haven).toBe(0);
    act(() => result.current.resetMap("B", "ascent"));
    expect(result.current.mapBDraft.ascent).toBe(0);
  });

  it("applyPreset merges preset deltas into the targeted side's draft", () => {
    const { result } = renderHook(() => useSimulatorState(["ascent"]));
    act(() => result.current.applyPreset("A", "improved-form"));
    expect(result.current.teamADraft.recentFormIndex).toBe(10);
    expect(result.current.teamBDraft.recentFormIndex).toBe(0);
  });

  it("simulateStart/-Success/-Error drive status and preserve drafts", () => {
    const { result } = renderHook(() => useSimulatorState(["ascent"]));
    act(() => result.current.setAttribute("A", "aggression", 8));

    act(() => result.current.simulateStart());
    expect(result.current.status).toBe("loading");
    expect(result.current.teamADraft.aggression).toBe(8);

    const fake = fakeResult();
    act(() => result.current.simulateSuccess(fake));
    expect(result.current.status).toBe("success");
    expect(result.current.simulationResult).toBe(fake);
    expect(result.current.requestCount).toBe(1);
  });

  it("simulateError preserves the draft and any prior successful result", () => {
    const { result } = renderHook(() => useSimulatorState(["ascent"]));
    act(() => result.current.setAttribute("A", "aggression", 8));
    act(() => result.current.simulateSuccess(fakeResult()));

    act(() => result.current.simulateStart());
    act(() => result.current.simulateError("Network error"));

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Network error");
    expect(result.current.teamADraft.aggression).toBe(8);
    expect(result.current.simulationResult).not.toBeNull();
  });

  it("a rerun replaces the prior simulation result rather than stacking", () => {
    const { result } = renderHook(() => useSimulatorState(["ascent"]));
    const first = fakeResult();
    act(() => result.current.simulateSuccess(first));
    const second = { ...fakeResult(), simulationId: "s2" };
    act(() => result.current.simulateSuccess(second));

    expect(result.current.simulationResult).toBe(second);
    expect(result.current.requestCount).toBe(2);
  });

  it("resetAll clears every draft, the simulation result, and the error, but preserves requestCount", () => {
    const { result } = renderHook(() => useSimulatorState(["ascent"]));
    act(() => result.current.setAttribute("A", "aggression", 8));
    act(() => result.current.simulateSuccess(fakeResult()));
    act(() => result.current.resetAll());

    expect(result.current.teamADraft.aggression).toBe(0);
    expect(result.current.hasAdjustments).toBe(false);
    expect(result.current.simulationResult).toBeNull();
    expect(result.current.status).toBe("idle");
    expect(result.current.requestCount).toBe(1);
  });
});
