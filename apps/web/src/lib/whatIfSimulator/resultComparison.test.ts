import { describe, expect, it } from "vitest";
import type { PredictionResult } from "@repo/shared";
import { buildSimulationSummary, compareOutcomes, diffContributions, diffKeyFactors, diffMatchDna } from "./resultComparison";

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
    explanation: "Paper Rex is favored primarily due to a aggression advantage over G2 Esports.",
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
    matchDna: { similarityScore: 70, complementaryTraits: [], conflictingTraits: ["aggression"], decisiveTrait: "aggression" },
    keyFactors: [
      { id: "aggression", label: "Aggression", impact: "positive", magnitude: 25, description: "Paper Rex leads in aggression." },
    ],
    insights: [],
    pipeline: [],
    warnings: [],
    generatedAt: new Date().toISOString(),
    predictionVersion: "test",
    ...overrides,
  };
}

describe("compareOutcomes", () => {
  it("expresses deltas in percentage points, simulated minus baseline", () => {
    const baseline = baseResult();
    const simulated = baseResult({
      outcomes: [
        { teamId: "paper-rex", winProbability: 0.66 },
        { teamId: "g2-esports", winProbability: 0.34 },
      ],
    });

    const comparison = compareOutcomes(baseline, simulated);
    expect(comparison.teamAProbabilityDeltaPoints).toBe(4);
    expect(comparison.teamBProbabilityDeltaPoints).toBe(-4);
  });

  it("detects a winner change", () => {
    const baseline = baseResult();
    const simulated = baseResult({ predictedWinnerId: "g2-esports" });
    expect(compareOutcomes(baseline, simulated).winnerChanged).toBe(true);
  });

  it("reports zero winner change when the winner is unchanged", () => {
    const baseline = baseResult();
    const simulated = baseResult();
    expect(compareOutcomes(baseline, simulated).winnerChanged).toBe(false);
  });

  it("computes confidence and trust score deltas", () => {
    const baseline = baseResult({ confidence: 70, trustScore: 80 });
    const simulated = baseResult({ confidence: 75, trustScore: 78 });
    const comparison = compareOutcomes(baseline, simulated);
    expect(comparison.confidenceDeltaPoints).toBe(5);
    expect(comparison.trustScoreDeltaPoints).toBe(-2);
  });

  it("never produces NaN even with a missing outcome", () => {
    const baseline = baseResult();
    const simulated = baseResult({ outcomes: [{ teamId: "paper-rex", winProbability: 0.7 }, { teamId: "g2-esports", winProbability: 0.3 }] });
    const comparison = compareOutcomes(baseline, simulated);
    expect(Number.isNaN(comparison.teamAProbabilityDeltaPoints)).toBe(false);
    expect(Number.isNaN(comparison.teamBProbabilityDeltaPoints)).toBe(false);
  });
});

describe("diffKeyFactors", () => {
  it("classifies a factor present in both as changed when its magnitude differs", () => {
    const baseline = baseResult();
    const simulated = baseResult({
      keyFactors: [{ id: "aggression", label: "Aggression", impact: "positive", magnitude: 30, description: "x" }],
    });
    const diff = diffKeyFactors(baseline, simulated);
    expect(diff[0]!.status).toBe("changed");
    expect(diff[0]!.magnitudeDeltaPoints).toBe(5);
  });

  it("classifies a factor only in the simulated result as new", () => {
    const baseline = baseResult({ keyFactors: [] });
    const simulated = baseResult();
    const diff = diffKeyFactors(baseline, simulated);
    expect(diff[0]!.status).toBe("new");
  });

  it("classifies a factor only in the baseline as removed", () => {
    const baseline = baseResult();
    const simulated = baseResult({ keyFactors: [] });
    const diff = diffKeyFactors(baseline, simulated);
    expect(diff[0]!.status).toBe("removed");
  });

  it("is sorted by largest absolute magnitude change first", () => {
    const baseline = baseResult({
      keyFactors: [
        { id: "aggression", label: "Aggression", impact: "positive", magnitude: 20, description: "x" },
        { id: "tempo", label: "Tempo", impact: "positive", magnitude: 15, description: "y" },
      ],
    });
    const simulated = baseResult({
      keyFactors: [
        { id: "aggression", label: "Aggression", impact: "positive", magnitude: 22, description: "x" },
        { id: "tempo", label: "Tempo", impact: "positive", magnitude: 25, description: "y" },
      ],
    });
    const diff = diffKeyFactors(baseline, simulated);
    expect(diff[0]!.id).toBe("tempo");
  });
});

describe("diffContributions", () => {
  it("reuses buildContributionRows and diffs by dimension id", () => {
    const baseline = baseResult();
    const simulated = baseResult({
      keyFactors: [{ id: "aggression", label: "Aggression", impact: "positive", magnitude: 10, description: "x" }],
    });
    const diff = diffContributions(baseline, simulated, "paper-rex");
    expect(diff[0]!.id).toBe("aggression");
    expect(diff[0]!.baselineShareOfTotal).toBe(100);
    expect(diff[0]!.simulatedShareOfTotal).toBe(100);
  });
});

describe("diffMatchDna", () => {
  it("computes per-dimension deltas and omits unchanged dimensions", () => {
    const baseline = baseResult();
    const simulated = baseResult({
      teamDna: [
        { teamId: "paper-rex", dimensions: baseResult().teamDna[0].dimensions.map((d) => (d.key === "aggression" ? { ...d, value: 90 } : d)) },
        baseResult().teamDna[1],
      ],
    });
    const diff = diffMatchDna(baseline, simulated);
    expect(diff.dimensionChanges).toHaveLength(1);
    expect(diff.dimensionChanges[0]!.key).toBe("aggression");
    expect(diff.dimensionChanges[0]!.deltaPoints).toBe(10);
  });

  it("detects a decisive trait change", () => {
    const baseline = baseResult();
    const simulated = baseResult({ matchDna: { ...baseResult().matchDna, decisiveTrait: "tempo" } });
    expect(diffMatchDna(baseline, simulated).decisiveTraitChanged).toBe(true);
  });
});

describe("buildSimulationSummary", () => {
  it("uses winner-change wording when the projected winner changes", () => {
    const comparison = compareOutcomes(baseResult(), baseResult({ predictedWinnerId: "g2-esports" }));
    const summary = buildSimulationSummary(comparison, "Paper Rex", "G2 Esports");
    expect(summary).toContain("changes the projected winner from Paper Rex to G2 Esports");
    expect(summary).toContain("not a forecast of real performance");
  });

  it("uses limited-effect wording for a sub-threshold change", () => {
    const comparison = compareOutcomes(baseResult(), baseResult());
    const summary = buildSimulationSummary(comparison, "Paper Rex", "G2 Esports");
    expect(summary).toContain("limited effect");
  });

  it("quantifies the change in percentage points when meaningful and the winner is unchanged", () => {
    const simulated = baseResult({
      outcomes: [
        { teamId: "paper-rex", winProbability: 0.68 },
        { teamId: "g2-esports", winProbability: 0.32 },
      ],
    });
    const comparison = compareOutcomes(baseResult(), simulated);
    const summary = buildSimulationSummary(comparison, "Paper Rex", "G2 Esports");
    expect(summary).toContain("increase Paper Rex's modeled win probability by 6 percentage points");
    expect(summary).toContain("Paper Rex remains the projected winner");
  });

  it("never contains guaranteed-outcome language", () => {
    const comparison = compareOutcomes(baseResult(), baseResult({ predictedWinnerId: "g2-esports" }));
    const summary = buildSimulationSummary(comparison, "Paper Rex", "G2 Esports");
    expect(summary).not.toMatch(/guarantee|will win|certain/i);
  });
});
