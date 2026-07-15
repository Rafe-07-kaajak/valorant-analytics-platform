import { describe, expect, it } from "vitest";
import type { TeamDna } from "@repo/shared";
import { computeDimensionAgreement, computeWeightedAdvantage, generateMatchDna } from "./matchDna";
import { getFeatureRegistry } from "./featureRegistry";

function dna(teamId: string, values: Record<string, number>): TeamDna {
  return {
    teamId,
    dimensions: Object.entries(values).map(([key, value]) => ({
      key: key as TeamDna["dimensions"][number]["key"],
      label: key,
      value,
    })),
  };
}

describe("generateMatchDna", () => {
  it("gives identical teams a perfect similarity score and no conflicts", () => {
    const a = dna("a", { aggression: 70, tempo: 60 });
    const b = dna("b", { aggression: 70, tempo: 60 });

    const result = generateMatchDna(a, b);

    expect(result.similarityScore).toBe(100);
    expect(result.conflictingTraits).toHaveLength(0);
  });

  it("flags a wide gap as a conflicting trait", () => {
    const a = dna("a", { aggression: 90, tempo: 50 });
    const b = dna("b", { aggression: 20, tempo: 50 });

    const result = generateMatchDna(a, b);

    expect(result.conflictingTraits).toContain("aggression");
    expect(result.conflictingTraits).not.toContain("tempo");
  });

  it("picks the dimension with the largest gap as the decisive trait", () => {
    const a = dna("a", { aggression: 90, tempo: 55, mapControl: 50 });
    const b = dna("b", { aggression: 40, tempo: 50, mapControl: 48 });

    const result = generateMatchDna(a, b);

    expect(result.decisiveTrait).toBe("aggression");
  });

  it("flags a small gap between two high scores as a complementary trait", () => {
    const a = dna("a", { clutchAbility: 80 });
    const b = dna("b", { clutchAbility: 75 });

    const result = generateMatchDna(a, b);

    expect(result.complementaryTraits).toContain("clutchAbility");
  });
});

describe("computeWeightedAdvantage", () => {
  it("computes the registry-weighted average diff by hand", () => {
    const a = dna("a", {
      aggression: 70,
      tempo: 50,
      mapControl: 60,
      utilityEfficiency: 55,
      adaptability: 65,
      clutchAbility: 80,
    });
    const b = dna("b", {
      aggression: 40,
      tempo: 50,
      mapControl: 50,
      utilityEfficiency: 45,
      adaptability: 55,
      clutchAbility: 50,
    });

    // Every registry weight is 1 (v1), so this is a plain average of the
    // per-dimension diffs: (30 + 0 + 10 + 10 + 10 + 30) / 6 = 15.
    const totalWeight = getFeatureRegistry().reduce((sum, feature) => sum + feature.weight, 0);
    expect(totalWeight).toBe(6);
    expect(computeWeightedAdvantage(a, b)).toBeCloseTo(15, 10);
  });

  it("is 0 for identical DNA profiles", () => {
    const a = dna("a", { aggression: 70, tempo: 50, mapControl: 60, utilityEfficiency: 55, adaptability: 65, clutchAbility: 80 });
    const b = dna("b", { aggression: 70, tempo: 50, mapControl: 60, utilityEfficiency: 55, adaptability: 65, clutchAbility: 80 });

    expect(computeWeightedAdvantage(a, b)).toBe(0);
  });

  it("is negative when Team B has the overall DNA advantage", () => {
    const a = dna("a", { aggression: 40, tempo: 50, mapControl: 50, utilityEfficiency: 45, adaptability: 55, clutchAbility: 50 });
    const b = dna("b", { aggression: 70, tempo: 50, mapControl: 60, utilityEfficiency: 55, adaptability: 65, clutchAbility: 80 });

    expect(computeWeightedAdvantage(a, b)).toBeLessThan(0);
  });
});

describe("computeDimensionAgreement", () => {
  it("is 1 when every dimension agrees with the overall advantage direction", () => {
    const a = dna("a", {
      aggression: 70,
      tempo: 50,
      mapControl: 60,
      utilityEfficiency: 55,
      adaptability: 65,
      clutchAbility: 80,
    });
    const b = dna("b", {
      aggression: 40,
      tempo: 50,
      mapControl: 50,
      utilityEfficiency: 45,
      adaptability: 55,
      clutchAbility: 50,
    });

    const weightedAdvantage = computeWeightedAdvantage(a, b);
    expect(computeDimensionAgreement(a, b, weightedAdvantage)).toBe(1);
  });

  it("computes a partial agreement fraction by hand when some dimensions disagree", () => {
    const a = dna("a", {
      aggression: 90,
      tempo: 50,
      mapControl: 20,
      utilityEfficiency: 55,
      adaptability: 30,
      clutchAbility: 80,
    });
    const b = dna("b", {
      aggression: 40,
      tempo: 50,
      mapControl: 60,
      utilityEfficiency: 45,
      adaptability: 70,
      clutchAbility: 50,
    });

    // weightedAdvantage = (50 + 0 - 40 + 10 - 40 + 30) / 6 = 10/6, sign +1.
    // Agreeing dimensions: aggression(+), tempo(0), utilityEfficiency(+), clutchAbility(+) = 4/6.
    const weightedAdvantage = computeWeightedAdvantage(a, b);
    expect(computeDimensionAgreement(a, b, weightedAdvantage)).toBeCloseTo(4 / 6, 10);
  });
});
