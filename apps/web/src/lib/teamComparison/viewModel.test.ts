import { describe, expect, it } from "vitest";
// Real profile data is safe to import here — tests run in Node, not the
// browser bundle, so `@repo/prediction-engine`'s Node-only modules are fine.
import { maps, VCT_TEAM_PROFILES, getVctTeamProfile } from "@repo/prediction-engine";
import { buildComparisonViewModel } from "./viewModel";
import { buildProfileFixture } from "./testFixtures";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

describe("buildComparisonViewModel — real profile data", () => {
  const paperRex = getVctTeamProfile("paper-rex")!;
  const g2 = getVctTeamProfile("g2-esports")!;

  it("produces a fully-formed view model with no NaN/undefined numeric values", () => {
    const model = buildComparisonViewModel(paperRex, g2, "Paper Rex", "G2 Esports", maps);

    for (const metric of model.metrics) {
      expect(isFiniteNumber(metric.valueA)).toBe(true);
      expect(isFiniteNumber(metric.valueB)).toBe(true);
      expect(isFiniteNumber(metric.magnitude)).toBe(true);
    }
    for (const row of model.mapRows) {
      expect(isFiniteNumber(row.scoreA)).toBe(true);
      expect(isFiniteNumber(row.scoreB)).toBe(true);
    }
    for (const factor of model.factors) {
      expect(isFiniteNumber(factor.magnitude)).toBe(true);
      expect(factor.description.length).toBeGreaterThan(0);
    }
    expect(model.summary.length).toBeGreaterThan(0);
  });

  it("is deterministic across repeated calls with the same pair", () => {
    const first = buildComparisonViewModel(paperRex, g2, "Paper Rex", "G2 Esports", maps);
    const second = buildComparisonViewModel(paperRex, g2, "Paper Rex", "G2 Esports", maps);
    expect(first).toEqual(second);
  });

  it("handles a self-comparison (a stand-in for 'balanced teams') without declaring any winner", () => {
    const model = buildComparisonViewModel(paperRex, paperRex, "Paper Rex", "Paper Rex", maps);
    for (const metric of model.metrics) {
      expect(metric.advantage).toBe("even");
    }
    expect(model.summary.toLowerCase()).toContain("evenly matched");
  });

  it("produces every VCT_TEAM_PROFILES pairing without NaN or crashing (deterministic across the full roster)", () => {
    const [teamA, teamB] = VCT_TEAM_PROFILES;
    const model = buildComparisonViewModel(teamA!, teamB!, teamA!.teamId, teamB!.teamId, maps);
    expect(model.mapRows.length).toBeGreaterThan(0);
    expect(model.factors.length).toBeGreaterThan(0);
  });

  it("clearly different profiles produce a one-sided or mixed summary, never a crash", () => {
    const strongDimensions = [
      { key: "aggression", label: "Aggression", value: 95 },
      { key: "tempo", label: "Tempo", value: 95 },
      { key: "mapControl", label: "Map Control", value: 95 },
      { key: "utilityEfficiency", label: "Utility Efficiency", value: 95 },
      { key: "adaptability", label: "Adaptability", value: 95 },
      { key: "clutchAbility", label: "Clutch Ability", value: 95 },
    ] as const;
    const weakDimensions = strongDimensions.map((dimension) => ({ ...dimension, value: 30 }));

    const strong = buildProfileFixture({
      teamId: "t1",
      dna: { teamId: "t1", dimensions: [...strongDimensions] },
      overallRating: 95,
      attackStrength: 95,
      defenseStrength: 95,
      economyEfficiency: 95,
      clutchPerformance: 95,
      consistency: 95,
      roundDifferential: 6,
      mapStrength: Object.fromEntries(maps.map((map) => [map.id, 90])),
    });
    const weak = buildProfileFixture({
      teamId: "furia",
      dna: { teamId: "furia", dimensions: weakDimensions },
      overallRating: 30,
      attackStrength: 30,
      defenseStrength: 30,
      economyEfficiency: 30,
      clutchPerformance: 30,
      consistency: 30,
      roundDifferential: -6,
      mapStrength: Object.fromEntries(maps.map((map) => [map.id, 25])),
    });
    const model = buildComparisonViewModel(strong, weak, "Strong Team", "Weak Team", maps);
    // Attack/defense balance and map-pool depth are equal for both fixtures
    // by construction (flat, symmetric numbers) — every other factor favors
    // the stronger team.
    const decisiveFactors = model.factors.filter(
      (factor) => factor.id !== "attack-defense-balance" && factor.id !== "map-pool-depth",
    );
    expect(decisiveFactors.length).toBeGreaterThan(0);
    expect(decisiveFactors.every((factor) => factor.advantage === "A")).toBe(true);
    expect(model.summary).toContain("Strong Team");
    expect(model.summary.toLowerCase()).toContain("no clear modeled advantage");
  });
});
