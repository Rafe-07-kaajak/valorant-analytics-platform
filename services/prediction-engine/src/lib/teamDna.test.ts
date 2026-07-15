import { describe, expect, it } from "vitest";
import type { NormalizedMatchHistory, NormalizedTeamAggregate } from "./normalizeMatchHistory";
import { DNA_DIMENSIONS, computeFormStability, generateTeamDna, getFeatureCoverage } from "./teamDna";

function fullAggregate(overrides: Partial<NormalizedTeamAggregate> = {}): NormalizedTeamAggregate {
  return {
    teamId: "fixture",
    matchesPlayed: 10,
    matchIds: [],
    overallWinRate: 0.5,
    averageRoundDifferential: 3,
    roundWinRate: 0.55,
    economyOutcomeRates: { eco: 0.3, force: 0.45, fullBuy: 0.6 },
    entrySuccessRate: 0.7,
    clutchConversionRate: 0.8,
    recentForm: {
      last5: { matchesConsidered: 5, wins: 3, winRate: 0.6 },
      last10: { matchesConsidered: 10, wins: 5, winRate: 0.5 },
    },
    mapPerformance: {
      ascent: { mapId: "ascent", matchesPlayed: 5, wins: 3, winRate: 0.6 },
      haven: { mapId: "haven", matchesPlayed: 5, wins: 2, winRate: 0.4 },
    },
    ...overrides,
  };
}

function historyWith(teamId: string, aggregate: NormalizedTeamAggregate): NormalizedMatchHistory {
  return { teams: { [teamId]: aggregate } };
}

describe("generateTeamDna", () => {
  it("is deterministic for the same team and normalized history", () => {
    const history = historyWith("sen", fullAggregate());
    expect(generateTeamDna("sen", history)).toEqual(generateTeamDna("sen", history));
  });

  it("includes every registered dimension exactly once", () => {
    const dna = generateTeamDna("sen", historyWith("sen", fullAggregate()));
    expect(dna.dimensions).toHaveLength(DNA_DIMENSIONS.length);
    const keys = dna.dimensions.map((d) => d.key);
    expect(new Set(keys).size).toBe(DNA_DIMENSIONS.length);
  });

  it("keeps every dimension value within the documented 0-100 range", () => {
    const dna = generateTeamDna("sen", historyWith("sen", fullAggregate()));
    for (const dimension of dna.dimensions) {
      expect(dimension.value).toBeGreaterThanOrEqual(0);
      expect(dimension.value).toBeLessThanOrEqual(100);
    }
  });

  it("computes every dimension by hand against a known fixture aggregate", () => {
    const dna = generateTeamDna("sen", historyWith("sen", fullAggregate()));
    const byKey = Object.fromEntries(dna.dimensions.map((d) => [d.key, d.value]));

    // Aggression = entrySuccessRate (0.7) * 100.
    expect(byKey.aggression).toBe(70);
    // Utility Efficiency = fullBuy economy rate (0.6) * 100.
    expect(byKey.utilityEfficiency).toBe(60);
    // Map Control = roundWinRate (0.55) * 100.
    expect(byKey.mapControl).toBe(55);
    // Clutch Ability = clutchConversionRate (0.8) * 100.
    expect(byKey.clutchAbility).toBe(80);
    // Tempo = 50 + |averageRoundDifferential (3)| * 4 = 62.
    expect(byKey.tempo).toBe(62);
    // Adaptability: map win rates [0.6, 0.4] -> mean 0.5, stdDev 0.1 -> 100 - 0.1*200 = 80.
    expect(byKey.adaptability).toBe(80);
  });

  it("falls back to a neutral 50 for every dimension when a team is unknown", () => {
    const dna = generateTeamDna("unknown-team", historyWith("sen", fullAggregate()));
    for (const dimension of dna.dimensions) {
      expect(dimension.value).toBe(50);
    }
  });

  it("falls back to a neutral 50 for a dimension with insufficient underlying data", () => {
    const sparseAggregate = fullAggregate({
      entrySuccessRate: null,
      averageRoundDifferential: null,
      mapPerformance: {},
    });
    const dna = generateTeamDna("sen", historyWith("sen", sparseAggregate));
    const byKey = Object.fromEntries(dna.dimensions.map((d) => [d.key, d.value]));

    expect(byKey.aggression).toBe(50);
    expect(byKey.tempo).toBe(50);
    expect(byKey.adaptability).toBe(50);
    // Dimensions with data are unaffected.
    expect(byKey.clutchAbility).toBe(80);
  });
});

describe("getFeatureCoverage", () => {
  it("is 1 when every dimension has sufficient data", () => {
    expect(getFeatureCoverage("sen", historyWith("sen", fullAggregate()))).toBe(1);
  });

  it("is 0 for an unknown team", () => {
    expect(getFeatureCoverage("unknown-team", historyWith("sen", fullAggregate()))).toBe(0);
  });

  it("reflects partial coverage when some dimensions lack data", () => {
    const sparseAggregate = fullAggregate({ entrySuccessRate: null, clutchConversionRate: null });
    const coverage = getFeatureCoverage("sen", historyWith("sen", sparseAggregate));
    expect(coverage).toBeCloseTo(4 / 6, 10);
  });
});

describe("computeFormStability", () => {
  it("is 1 when recent form exactly matches overall win rate", () => {
    const aggregate = fullAggregate({
      overallWinRate: 0.5,
      recentForm: {
        last5: { matchesConsidered: 5, wins: 3, winRate: 0.6 },
        last10: { matchesConsidered: 10, wins: 5, winRate: 0.5 },
      },
    });
    expect(computeFormStability("sen", historyWith("sen", aggregate))).toBe(1);
  });

  it("falls back to a neutral 0.5 when data is unavailable", () => {
    expect(computeFormStability("unknown-team", historyWith("sen", fullAggregate()))).toBe(0.5);
  });
});
