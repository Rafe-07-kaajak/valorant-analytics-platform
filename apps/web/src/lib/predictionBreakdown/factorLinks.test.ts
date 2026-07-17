import { describe, expect, it } from "vitest";
import { findContributionForFactor, findDnaDimensionForFactor } from "./factorLinks";
import type { ContributionRow, DnaGapRow } from "./types";

function contribution(overrides: Partial<ContributionRow> = {}): ContributionRow {
  return {
    id: "aggression",
    label: "Aggression",
    description: "",
    direction: "A",
    magnitude: 20,
    signedMagnitude: 20,
    shareOfTotal: 100,
    rank: 1,
    ...overrides,
  };
}

function dnaRow(overrides: Partial<DnaGapRow> = {}): DnaGapRow {
  return {
    key: "aggression",
    label: "Aggression",
    valueA: 70,
    valueB: 50,
    advantage: "A",
    tier: "moderate",
    magnitude: 20,
    ...overrides,
  };
}

describe("findContributionForFactor", () => {
  it("finds the contribution row sharing the same id", () => {
    const rows = [contribution({ id: "aggression" }), contribution({ id: "tempo" })];
    expect(findContributionForFactor("tempo", rows)?.id).toBe("tempo");
  });

  it("returns null rather than guessing when no row shares the id", () => {
    const rows = [contribution({ id: "aggression" })];
    expect(findContributionForFactor("clutchAbility", rows)).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(findContributionForFactor("aggression", [])).toBeNull();
  });
});

describe("findDnaDimensionForFactor", () => {
  it("finds the DNA dimension sharing the same key", () => {
    const rows = [dnaRow({ key: "aggression" }), dnaRow({ key: "tempo", label: "Tempo" })];
    expect(findDnaDimensionForFactor("tempo", rows)?.label).toBe("Tempo");
  });

  it("returns null rather than guessing when no dimension shares the key", () => {
    expect(findDnaDimensionForFactor("clutchAbility", [dnaRow({ key: "aggression" })])).toBeNull();
  });
});
