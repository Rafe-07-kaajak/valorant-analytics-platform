import { describe, expect, it } from "vitest";
import { adaptDisclosureForComparison, generateNeutralSummary } from "./summary";
import type { ComparisonFactor } from "./types";

const TEAM_A = "Paper Rex";
const TEAM_B = "G2 Esports";

function factor(overrides: Partial<ComparisonFactor>): ComparisonFactor {
  return {
    id: "test",
    title: "Test Factor",
    description: "",
    advantage: "even",
    tier: "none",
    magnitude: 0,
    ...overrides,
  };
}

describe("generateNeutralSummary", () => {
  it("falls back to a balanced sentence when no factor favors either team", () => {
    const summary = generateNeutralSummary(TEAM_A, TEAM_B, [factor({ advantage: "even" })]);
    expect(summary).toContain(TEAM_A);
    expect(summary).toContain(TEAM_B);
    expect(summary.toLowerCase()).toContain("evenly matched");
  });

  it("names both teams when each has a leading factor", () => {
    const summary = generateNeutralSummary(TEAM_A, TEAM_B, [
      factor({ title: "Aggression Advantage", advantage: "A", magnitude: 20 }),
      factor({ title: "Consistency Edge", advantage: "B", magnitude: 15 }),
    ]);
    expect(summary).toContain(TEAM_A);
    expect(summary).toContain(TEAM_B);
    expect(summary).toContain("aggression");
    expect(summary).toContain("consistency");
  });

  it("uses the one-sided phrasing when every factor favors the same team", () => {
    const summary = generateNeutralSummary(TEAM_A, TEAM_B, [
      factor({ title: "Aggression Advantage", advantage: "A", magnitude: 20 }),
      factor({ title: "Economy Edge", advantage: "A", magnitude: 18 }),
    ]);
    expect(summary).toContain(TEAM_A);
    expect(summary).toContain(TEAM_B);
    expect(summary.toLowerCase()).toContain("no clear modeled advantage");
  });

  it("never uses hype or certainty language", () => {
    const summary = generateNeutralSummary(TEAM_A, TEAM_B, [
      factor({ title: "Aggression Advantage", advantage: "A", magnitude: 20 }),
      factor({ title: "Economy Edge", advantage: "B", magnitude: 18 }),
    ]);
    for (const forbidden of ["will win", "guaranteed", "dominant", "crush", "official"]) {
      expect(summary.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("is deterministic for the same input", () => {
    const factors = [
      factor({ title: "Aggression Advantage", advantage: "A", magnitude: 20 }),
      factor({ title: "Economy Edge", advantage: "B", magnitude: 18 }),
    ];
    expect(generateNeutralSummary(TEAM_A, TEAM_B, factors)).toBe(
      generateNeutralSummary(TEAM_A, TEAM_B, factors),
    );
  });
});

describe("adaptDisclosureForComparison", () => {
  it("swaps the leading verb phrase while preserving the rest of the sentence", () => {
    const original =
      "Predictions use simulated team profiles for demonstration purposes. Values are modeled estimates, not real statistics from Riot Games or any tournament.";
    const adapted = adaptDisclosureForComparison(original);
    expect(adapted).toBe(
      "This comparison uses simulated team profiles for demonstration purposes. Values are modeled estimates, not real statistics from Riot Games or any tournament.",
    );
  });

  it("leaves an unrelated string untouched", () => {
    expect(adaptDisclosureForComparison("Some other sentence.")).toBe("Some other sentence.");
  });
});
