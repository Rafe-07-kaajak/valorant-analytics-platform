import { describe, expect, it } from "vitest";
import type { PredictionRequest } from "@repo/shared";
import { generatePrediction } from "./generatePrediction";

function request(overrides: Partial<PredictionRequest["scenario"]> = {}): PredictionRequest {
  return {
    requestId: crypto.randomUUID(),
    scenario: {
      teamAId: "sen",
      teamBId: "loud",
      seriesFormat: "BO3",
      mapIds: ["ascent", "haven", "bind"],
      ...overrides,
    },
  };
}

describe("generatePrediction", () => {
  it("returns a fully-shaped PredictionResult", () => {
    const result = generatePrediction(request());

    expect(result.outcomes).toHaveLength(2);
    expect(["sen", "loud"]).toContain(result.predictedWinnerId);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
    expect(result.teamDna).toHaveLength(2);
    expect(result.pipeline.length).toBeGreaterThan(0);
    expect(result.keyFactors).toBeInstanceOf(Array);
    expect(result.insights.length).toBeGreaterThan(0);
  });

  it("produces the same analytical content for the same scenario (cache hit)", () => {
    const first = generatePrediction(request());
    const second = generatePrediction(request());

    expect(second.outcomes).toEqual(first.outcomes);
    expect(second.confidence).toBe(first.confidence);
    expect(second.teamDna).toEqual(first.teamDna);
    // Request-scoped metadata is always fresh, even on a cache hit.
    expect(second.requestId).not.toBe(first.requestId);
    expect(second.predictionId).not.toBe(first.predictionId);
  });

  it("echoes back the scenario actually submitted on a cache hit, not a prior submitter's map order", () => {
    const first = generatePrediction(request({ mapIds: ["ascent", "haven", "bind"] }));
    const second = generatePrediction(request({ mapIds: ["bind", "ascent", "haven"] }));

    expect(second.scenario.mapIds).toEqual(["bind", "ascent", "haven"]);
    expect(first.scenario.mapIds).toEqual(["ascent", "haven", "bind"]);
  });

  it("keeps a distinct cache entry per scenario instead of reusing an unrelated one", () => {
    // Different team pairs are guaranteed a different seed (unlike BO3 vs BO5 for the
    // same pair, which can coincidentally round to the same 2-decimal probability),
    // so this is the reliable way to assert scenarios don't collide in the cache.
    const senVsLoud = generatePrediction(request());
    const fncVsTh = generatePrediction(request({ teamAId: "fnc", teamBId: "th" }));

    expect(fncVsTh.outcomes).not.toEqual(senVsLoud.outcomes);
    expect(fncVsTh.teamDna).not.toEqual(senVsLoud.teamDna);
  });

  it("throws for an unknown team", () => {
    expect(() => generatePrediction(request({ teamAId: "not-a-real-team" }))).toThrow();
  });
});
