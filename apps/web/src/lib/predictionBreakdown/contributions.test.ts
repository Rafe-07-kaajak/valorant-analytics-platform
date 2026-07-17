import { describe, expect, it } from "vitest";
import type { KeyFactor } from "@repo/shared";
import { buildContributionRows } from "./contributions";

const TEAM_A_ID = "paper-rex";
const TEAM_B_ID = "g2-esports";

function factor(overrides: Partial<KeyFactor>): KeyFactor {
  return {
    id: "aggression",
    label: "Aggression",
    impact: "positive",
    magnitude: 20,
    description: "Paper Rex leads in aggression (78 vs 58 for G2 Esports).",
    ...overrides,
  };
}

describe("buildContributionRows", () => {
  it("returns an empty array for an empty keyFactors input (zero-total case)", () => {
    expect(buildContributionRows([], TEAM_A_ID, TEAM_A_ID)).toEqual([]);
  });

  it("ranks by descending magnitude", () => {
    const rows = buildContributionRows(
      [factor({ id: "a", magnitude: 10 }), factor({ id: "b", magnitude: 25 }), factor({ id: "c", magnitude: 15 })],
      TEAM_A_ID,
      TEAM_A_ID,
    );
    expect(rows.map((row) => row.id)).toEqual(["b", "c", "a"]);
    expect(rows.map((row) => row.rank)).toEqual([1, 2, 3]);
  });

  it("breaks exact magnitude ties alphabetically by label", () => {
    const rows = buildContributionRows(
      [
        factor({ id: "z", label: "Zulu", magnitude: 15 }),
        factor({ id: "a", label: "Alpha", magnitude: 15 }),
      ],
      TEAM_A_ID,
      TEAM_A_ID,
    );
    expect(rows.map((row) => row.id)).toEqual(["a", "z"]);
  });

  it("computes shares that sum to approximately 100", () => {
    const rows = buildContributionRows(
      [factor({ id: "a", magnitude: 10 }), factor({ id: "b", magnitude: 20 }), factor({ id: "c", magnitude: 30 })],
      TEAM_A_ID,
      TEAM_A_ID,
    );
    const total = rows.reduce((sum, row) => sum + row.shareOfTotal, 0);
    expect(total).toBeGreaterThanOrEqual(98);
    expect(total).toBeLessThanOrEqual(102);
  });

  it("never produces NaN shares even with a single row", () => {
    const rows = buildContributionRows([factor({ magnitude: 12 })], TEAM_A_ID, TEAM_A_ID);
    expect(rows[0]!.shareOfTotal).toBe(100);
    expect(Number.isNaN(rows[0]!.shareOfTotal)).toBe(false);
  });

  it("classifies direction A when the winner (Team A) has a positive-impact factor", () => {
    const rows = buildContributionRows([factor({ impact: "positive" })], TEAM_A_ID, TEAM_A_ID);
    expect(rows[0]!.direction).toBe("A");
    expect(rows[0]!.signedMagnitude).toBe(20);
  });

  it("classifies direction B when the winner (Team B) has a positive-impact factor", () => {
    const rows = buildContributionRows([factor({ impact: "positive" })], TEAM_B_ID, TEAM_A_ID);
    expect(rows[0]!.direction).toBe("B");
    expect(rows[0]!.signedMagnitude).toBe(-20);
  });

  it("classifies direction B when the winner (Team A) has a negative-impact (loser-favoring) factor", () => {
    const rows = buildContributionRows([factor({ impact: "negative" })], TEAM_A_ID, TEAM_A_ID);
    expect(rows[0]!.direction).toBe("B");
  });

  it("treats a zero-magnitude factor as neutral rather than crashing", () => {
    const rows = buildContributionRows([factor({ magnitude: 0 })], TEAM_A_ID, TEAM_A_ID);
    expect(rows[0]!.direction).toBe("neutral");
  });

  it("preserves the original label/description/magnitude untouched", () => {
    const input = factor({ label: "Tempo", description: "Some exact description.", magnitude: 17 });
    const rows = buildContributionRows([input], TEAM_A_ID, TEAM_A_ID);
    expect(rows[0]!.label).toBe("Tempo");
    expect(rows[0]!.description).toBe("Some exact description.");
    expect(rows[0]!.magnitude).toBe(17);
  });

  it("is deterministic for the same input", () => {
    const input = [factor({ id: "a", magnitude: 10 }), factor({ id: "b", magnitude: 20 })];
    expect(buildContributionRows(input, TEAM_A_ID, TEAM_A_ID)).toEqual(
      buildContributionRows(input, TEAM_A_ID, TEAM_A_ID),
    );
  });
});
