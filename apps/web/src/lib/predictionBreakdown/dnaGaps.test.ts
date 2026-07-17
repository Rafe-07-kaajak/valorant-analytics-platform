import { describe, expect, it } from "vitest";
import type { TeamDna } from "@repo/shared";
import { buildDnaGapRows, explainLargestGaps, findLargestGapDimensions } from "./dnaGaps";

const TEAM_A = "Paper Rex";
const TEAM_B = "G2 Esports";

function dna(overrides: Partial<Record<string, number>> = {}): TeamDna {
  const base: Record<string, number> = {
    aggression: 60,
    tempo: 60,
    mapControl: 60,
    utilityEfficiency: 60,
    adaptability: 60,
    clutchAbility: 60,
    ...overrides,
  };
  return {
    teamId: "team",
    dimensions: [
      { key: "aggression", label: "Aggression", value: base.aggression! },
      { key: "tempo", label: "Tempo", value: base.tempo! },
      { key: "mapControl", label: "Map Control", value: base.mapControl! },
      { key: "utilityEfficiency", label: "Utility Efficiency", value: base.utilityEfficiency! },
      { key: "adaptability", label: "Adaptability", value: base.adaptability! },
      { key: "clutchAbility", label: "Clutch Ability", value: base.clutchAbility! },
    ],
  };
}

describe("buildDnaGapRows", () => {
  it("returns one row per dimension with no NaN", () => {
    const rows = buildDnaGapRows(dna({ aggression: 80 }), dna());
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      expect(Number.isNaN(row.magnitude)).toBe(false);
    }
  });

  it("is deterministic", () => {
    const a = dna({ aggression: 80 });
    const b = dna();
    expect(buildDnaGapRows(a, b)).toEqual(buildDnaGapRows(a, b));
  });
});

describe("findLargestGapDimensions", () => {
  it("returns the requested count, largest first", () => {
    const rows = buildDnaGapRows(dna({ aggression: 90, tempo: 85 }), dna());
    const largest = findLargestGapDimensions(rows, 2);
    expect(largest).toHaveLength(2);
    expect(largest[0]!.key).toBe("aggression");
    expect(largest[1]!.key).toBe("tempo");
  });

  it("breaks exact ties alphabetically by label", () => {
    const rows = buildDnaGapRows(dna({ tempo: 90, aggression: 90 }), dna());
    const largest = findLargestGapDimensions(rows, 1);
    expect(largest[0]!.key).toBe("aggression");
  });
});

describe("explainLargestGaps", () => {
  it("supports a fully balanced pair without declaring a leader", () => {
    const rows = buildDnaGapRows(dna(), dna());
    const summary = explainLargestGaps(rows, TEAM_A, TEAM_B);
    expect(summary).toContain(TEAM_A);
    expect(summary).toContain(TEAM_B);
    expect(summary.toLowerCase()).toContain("similar modeled profile");
  });

  it("names the leading team for a clear gap", () => {
    const rows = buildDnaGapRows(dna({ aggression: 90 }), dna());
    const summary = explainLargestGaps(rows, TEAM_A, TEAM_B);
    expect(summary).toContain(TEAM_A);
    expect(summary.toLowerCase()).toContain("aggression");
  });

  it("mentions both teams when each leads a different top dimension", () => {
    const rows = buildDnaGapRows(dna({ aggression: 90, tempo: 20 }), dna());
    const summary = explainLargestGaps(rows, TEAM_A, TEAM_B);
    expect(summary).toContain(TEAM_A);
    expect(summary).toContain(TEAM_B);
  });

  it("is deterministic for the same input", () => {
    const rows = buildDnaGapRows(dna({ aggression: 90 }), dna());
    expect(explainLargestGaps(rows, TEAM_A, TEAM_B)).toBe(explainLargestGaps(rows, TEAM_A, TEAM_B));
  });

  it("never uses causal or official-data language", () => {
    const rows = buildDnaGapRows(dna({ aggression: 90 }), dna());
    const summary = explainLargestGaps(rows, TEAM_A, TEAM_B).toLowerCase();
    for (const forbidden of ["causes", "will win", "official", "guaranteed"]) {
      expect(summary).not.toContain(forbidden);
    }
  });
});
