import { describe, expect, it } from "vitest";
import type { VctTeam, VctTeamId } from "../../constants/vct";
import type { RealTeamPowerState } from "./realTeamPowerState";
import { buildRealPowerRankings, computeDataConfidence, computeRealPopulationPriors, computeRealPowerScore } from "./rankingModel";

/**
 * Real-data-correction task, Part G — sanity/policy invariants for the real
 * Power Score formula. Entirely synthetic fixtures (fictitious team ids/
 * names): this file tests the *math*, never asserts anything about a real
 * team's actual standing.
 */

function team(id: string): VctTeam {
  return { id: id as VctTeamId, name: `Team ${id}`, shortName: id.toUpperCase().slice(0, 3), region: "americas", logoPath: `/fake/${id}.png` };
}

function state(overrides: Partial<RealTeamPowerState> & { teamId: string }): RealTeamPowerState {
  return {
    seriesCountInWindow: 20,
    eloRating: 1500,
    recentFormIndex: 50,
    mapDepthScore: 50,
    consistency: 50,
    opponentAdjusted: 50,
    competitionTier: 50,
    ...overrides,
  };
}

describe("computeRealPowerScore — explainability sums to the final score", () => {
  it("baseRating + every contribution + uncertaintyPenalty equals finalScore, for a well-sampled team", () => {
    const s = state({ teamId: "alpha", seriesCountInWindow: 40, eloRating: 1650, recentFormIndex: 70, mapDepthScore: 60, consistency: 80, opponentAdjusted: 65, competitionTier: 90 });
    const priors = computeRealPopulationPriors([s]);
    const explain = computeRealPowerScore(s, priors);

    const sum =
      explain.baseRating +
      explain.formContribution +
      explain.opponentAdjustedContribution +
      explain.mapDepthContribution +
      explain.competitionTierContribution +
      explain.consistencyContribution +
      explain.uncertaintyPenalty;

    expect(sum).toBeCloseTo(explain.finalScore, 5);
  });

  it("also holds for a sparse (low-sample) team", () => {
    const s = state({ teamId: "beta", seriesCountInWindow: 2, eloRating: 1400 });
    const priors = computeRealPopulationPriors([s]);
    const explain = computeRealPowerScore(s, priors);

    const sum =
      explain.baseRating +
      explain.formContribution +
      explain.opponentAdjustedContribution +
      explain.mapDepthContribution +
      explain.competitionTierContribution +
      explain.consistencyContribution +
      explain.uncertaintyPenalty;

    expect(sum).toBeCloseTo(explain.finalScore, 5);
  });
});

describe("buildRealPowerRankings — zero-data teams can never outrank a substantially-sampled team", () => {
  it("a team absent from `states` (unrated) always ranks below every team with real match history", () => {
    const [ratedTeam, unratedTeam] = [team("rated"), team("unrated")];
    const teams = [ratedTeam, unratedTeam];
    const states = new Map([["rated", state({ teamId: "rated", seriesCountInWindow: 25, eloRating: 1600 })]]);

    const entries = buildRealPowerRankings(teams, states, new Set(["rated"]));
    const rated = entries.find((e) => e.team.id === ratedTeam.id)!;
    const unrated = entries.find((e) => e.team.id === unratedTeam.id)!;

    expect(unrated.dataConfidence).toBe("unrated");
    expect(unrated.powerScore).toBe(0);
    expect(rated.globalRank).toBeLessThan(unrated.globalRank);
  });
});

describe("computeDataConfidence", () => {
  it("is 'unrated' when the team has no real-data state at all", () => {
    expect(computeDataConfidence(undefined, true)).toBe("unrated");
  });

  it("is 'verified' only when identity is verified AND the sample size is well-sampled", () => {
    const wellSampled = state({ teamId: "x", seriesCountInWindow: 15 });
    expect(computeDataConfidence(wellSampled, true)).toBe("verified");
  });

  it("is 'provisional' when identity is verified but the sample size is small", () => {
    const sparse = state({ teamId: "x", seriesCountInWindow: 3 });
    expect(computeDataConfidence(sparse, true)).toBe("provisional");
  });

  it("is 'provisional' when well-sampled but identity is not verified", () => {
    const wellSampled = state({ teamId: "x", seriesCountInWindow: 15 });
    expect(computeDataConfidence(wellSampled, false)).toBe("provisional");
  });
});

describe("uncertainty penalty — a provisional (low-sample) team is penalized strictly more than an otherwise-identical verified (well-sampled) team", () => {
  it("the sparse team's uncertaintyPenalty has strictly larger magnitude", () => {
    const sparse = state({ teamId: "sparse", seriesCountInWindow: 2 });
    const wellSampled = state({ teamId: "well-sampled", seriesCountInWindow: 30 });
    const priors = computeRealPopulationPriors([sparse, wellSampled]);

    const sparseExplain = computeRealPowerScore(sparse, priors);
    const wellSampledExplain = computeRealPowerScore(wellSampled, priors);

    expect(Math.abs(sparseExplain.uncertaintyPenalty)).toBeGreaterThan(Math.abs(wellSampledExplain.uncertaintyPenalty));
    expect(wellSampledExplain.uncertaintyPenalty).toBe(0);
  });

  it("penalty magnitude is monotonically non-increasing as sample size grows", () => {
    const sampleSizes = [1, 3, 5, 8, 10, 15, 30];
    const states = sampleSizes.map((n) => state({ teamId: `n${n}`, seriesCountInWindow: n }));
    const priors = computeRealPopulationPriors(states);
    const penalties = states.map((s) => Math.abs(computeRealPowerScore(s, priors).uncertaintyPenalty));

    for (let i = 1; i < penalties.length; i += 1) {
      expect(penalties[i]!).toBeLessThanOrEqual(penalties[i - 1]!);
    }
  });
});

describe("form contribution — a declining recent-form sequence monotonically decreases it", () => {
  it("holds across a descending recentFormIndex sequence, all else equal", () => {
    const formValues = [90, 70, 50, 30, 10];
    const states = formValues.map((v) => state({ teamId: `form-${v}`, recentFormIndex: v, seriesCountInWindow: 40 }));
    const priors = computeRealPopulationPriors(states);
    const contributions = states.map((s) => computeRealPowerScore(s, priors).formContribution);

    for (let i = 1; i < contributions.length; i += 1) {
      expect(contributions[i]!).toBeLessThan(contributions[i - 1]!);
    }
  });
});

describe("opponent-adjusted contribution — stronger opposition contributes more, all else equal", () => {
  it("a team with a higher opponentAdjusted value gets a strictly larger contribution", () => {
    const weak = state({ teamId: "weak-schedule", opponentAdjusted: 20, seriesCountInWindow: 40 });
    const strong = state({ teamId: "strong-schedule", opponentAdjusted: 80, seriesCountInWindow: 40 });
    const priors = computeRealPopulationPriors([weak, strong]);

    const weakExplain = computeRealPowerScore(weak, priors);
    const strongExplain = computeRealPowerScore(strong, priors);

    expect(strongExplain.opponentAdjustedContribution).toBeGreaterThan(weakExplain.opponentAdjustedContribution);
  });
});

describe("buildRealPowerRankings — determinism", () => {
  it("run twice on identical input produces byte-identical order and scores", () => {
    const teams = [team("a"), team("b"), team("c")];
    const states = new Map([
      ["a", state({ teamId: "a", eloRating: 1600, seriesCountInWindow: 30 })],
      ["b", state({ teamId: "b", eloRating: 1450, seriesCountInWindow: 5 })],
      ["c", state({ teamId: "c", eloRating: 1550, seriesCountInWindow: 15 })],
    ]);
    const verified = new Set(["a", "c"]);

    const first = buildRealPowerRankings(teams, states, verified);
    const second = buildRealPowerRankings(teams, states, verified);

    expect(second).toEqual(first);
  });
});

describe("no NaN or Infinity across edge-case fixtures", () => {
  it("handles zero games, extreme Elo, and boundary sample sizes without producing NaN/Infinity", () => {
    const edgeCases: RealTeamPowerState[] = [
      state({ teamId: "min-sample", seriesCountInWindow: 1, eloRating: 400 }),
      state({ teamId: "extreme-high-elo", eloRating: 3000, seriesCountInWindow: 50 }),
      state({ teamId: "extreme-low-elo", eloRating: 0, seriesCountInWindow: 50 }),
      state({ teamId: "zero-everything", recentFormIndex: 0, mapDepthScore: 0, consistency: 0, opponentAdjusted: 0, competitionTier: 0, seriesCountInWindow: 1 }),
    ];
    const priors = computeRealPopulationPriors(edgeCases);

    for (const edgeCase of edgeCases) {
      const explain = computeRealPowerScore(edgeCase, priors);
      for (const value of Object.values(explain)) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });

  it("buildRealPowerRankings handles an entirely empty states map without error", () => {
    const teams = [team("only-team")];
    const entries = buildRealPowerRankings(teams, new Map(), new Set());
    expect(entries).toHaveLength(1);
    expect(entries[0]!.dataConfidence).toBe("unrated");
    expect(Number.isFinite(entries[0]!.powerScore)).toBe(true);
  });
});

describe("buildRealPowerRankings — powerScore matches the entry's own explainability.finalScore", () => {
  it("entry.powerScore equals explainability.finalScore for every rated team", () => {
    const teams = [team("a"), team("b")];
    const states = new Map([
      ["a", state({ teamId: "a", eloRating: 1600, seriesCountInWindow: 30 })],
      ["b", state({ teamId: "b", eloRating: 1450, seriesCountInWindow: 5 })],
    ]);
    const entries = buildRealPowerRankings(teams, states, new Set(["a", "b"]));

    for (const entry of entries) {
      expect(entry.explainability).toBeDefined();
      expect(entry.powerScore).toBe(entry.explainability!.finalScore);
    }
  });
});
