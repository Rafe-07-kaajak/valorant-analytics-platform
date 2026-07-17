import { describe, expect, it } from "vitest";
import { deriveFactors } from "./factors";
import { buildProfileFixture } from "./testFixtures";

const TEAM_A = "Paper Rex";
const TEAM_B = "G2 Esports";

describe("deriveFactors", () => {
  it("returns one factor per tracked dimension, sorted by magnitude descending", () => {
    const profileA = buildProfileFixture({
      dna: {
        teamId: "a",
        dimensions: [
          { key: "aggression", label: "Aggression", value: 90 },
          { key: "tempo", label: "Tempo", value: 65 },
          { key: "mapControl", label: "Map Control", value: 60 },
          { key: "utilityEfficiency", label: "Utility Efficiency", value: 68 },
          { key: "adaptability", label: "Adaptability", value: 62 },
          { key: "clutchAbility", label: "Clutch Ability", value: 66 },
        ],
      },
    });
    const profileB = buildProfileFixture({
      dna: {
        teamId: "b",
        dimensions: [
          { key: "aggression", label: "Aggression", value: 40 },
          { key: "tempo", label: "Tempo", value: 65 },
          { key: "mapControl", label: "Map Control", value: 60 },
          { key: "utilityEfficiency", label: "Utility Efficiency", value: 68 },
          { key: "adaptability", label: "Adaptability", value: 62 },
          { key: "clutchAbility", label: "Clutch Ability", value: 66 },
        ],
      },
    });

    const factors = deriveFactors(profileA, profileB, TEAM_A, TEAM_B);
    expect(factors.length).toBeGreaterThan(0);
    expect(factors[0]!.id).toBe("aggression");
    expect(factors[0]!.advantage).toBe("A");

    const magnitudes = factors.map((factor) => factor.magnitude);
    expect(magnitudes).toEqual([...magnitudes].sort((a, b) => b - a));
  });

  it("declares every factor even for identical profiles — no false winners, no NaN", () => {
    const profile = buildProfileFixture();
    const factors = deriveFactors(profile, profile, TEAM_A, TEAM_B);
    for (const factor of factors) {
      expect(factor.advantage).toBe("even");
      expect(Number.isNaN(factor.magnitude)).toBe(false);
      expect(factor.description.length).toBeGreaterThan(0);
    }
  });

  it("names the correct team in the description text", () => {
    const profileA = buildProfileFixture({ economyEfficiency: 90 });
    const profileB = buildProfileFixture({ economyEfficiency: 40 });
    const factors = deriveFactors(profileA, profileB, TEAM_A, TEAM_B);
    const economy = factors.find((factor) => factor.id === "economy-edge")!;
    expect(economy.advantage).toBe("A");
    expect(economy.description).toContain(TEAM_A);
  });

  it("credits the team with the smaller attack/defense skew as more balanced", () => {
    const balanced = buildProfileFixture({ attackStrength: 70, defenseStrength: 70 });
    const skewed = buildProfileFixture({ attackStrength: 90, defenseStrength: 40 });
    const factors = deriveFactors(balanced, skewed, TEAM_A, TEAM_B);
    const balance = factors.find((factor) => factor.id === "attack-defense-balance")!;
    expect(balance.advantage).toBe("A");
  });

  it("credits the team with lower map-strength spread as deeper map pool", () => {
    const deep = buildProfileFixture({ mapStrength: { a: 60, b: 62, c: 58, d: 61 } });
    const shallow = buildProfileFixture({ mapStrength: { a: 90, b: 30, c: 85, d: 25 } });
    const factors = deriveFactors(deep, shallow, TEAM_A, TEAM_B);
    const depth = factors.find((factor) => factor.id === "map-pool-depth")!;
    expect(depth.advantage).toBe("A");
  });

  it("is deterministic for the same input", () => {
    const profileA = buildProfileFixture({ overallRating: 80 });
    const profileB = buildProfileFixture({ overallRating: 55 });
    expect(deriveFactors(profileA, profileB, TEAM_A, TEAM_B)).toEqual(
      deriveFactors(profileA, profileB, TEAM_A, TEAM_B),
    );
  });
});
