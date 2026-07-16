import { describe, expect, it } from "vitest";
import type { MatchDna, Team, TeamDna } from "@repo/shared";
import type { HeadToHeadRecord } from "./analyticsEngine";
import type { FormWindow } from "./normalizeMatchHistory";
import { generateInsights, generateKeyFactors, type GenerateInsightsInput } from "./insights";

const winner: Team = { id: "sen", name: "Sentinels", region: "Americas", logoUrl: "" };
const loser: Team = { id: "loud", name: "LOUD", region: "Americas", logoUrl: "" };

function dna(teamId: string, values: Record<string, number>): TeamDna {
  return {
    teamId,
    dimensions: Object.entries(values).map(([key, value]) => ({
      key: key as TeamDna["dimensions"][number]["key"],
      label: key === "mapControl" ? "Map Control" : key,
      value,
    })),
  };
}

const matchDna: MatchDna = {
  similarityScore: 80,
  complementaryTraits: [],
  conflictingTraits: ["aggression"],
  decisiveTrait: "aggression",
};

const noRecentForm: FormWindow = { matchesConsidered: 0, wins: 0, winRate: null };

function baseInput(overrides: Partial<GenerateInsightsInput> = {}): GenerateInsightsInput {
  return {
    winner,
    loser,
    winnerDna: dna("sen", { aggression: 90 }),
    loserDna: dna("loud", { aggression: 40 }),
    matchDna,
    confidence: 80,
    trustScore: 90,
    headToHead: null,
    winnerRecentForm: null,
    loserRecentForm: null,
    dimensionAgreement: 0.8,
    formStability: 0.7,
    featureCoverage: 0.9,
    ...overrides,
  };
}

describe("generateKeyFactors", () => {
  it("marks factors favoring the winner as positive and the rest negative", () => {
    const winnerDna = dna("sen", { aggression: 90, mapControl: 30 });
    const loserDna = dna("loud", { aggression: 40, mapControl: 70 });

    const factors = generateKeyFactors(baseInput({ winnerDna, loserDna }));

    const aggressionFactor = factors.find((f) => f.id === "aggression");
    const mapControlFactor = factors.find((f) => f.id === "mapControl");

    expect(aggressionFactor?.impact).toBe("positive");
    expect(mapControlFactor?.impact).toBe("negative");
  });

  it("filters out near-equal dimensions and sorts by magnitude descending", () => {
    const winnerDna = dna("sen", { aggression: 90, tempo: 51 });
    const loserDna = dna("loud", { aggression: 40, tempo: 50 });

    const factors = generateKeyFactors(baseInput({ winnerDna, loserDna }));

    expect(factors.map((f) => f.id)).toEqual(["aggression"]);
  });
});

describe("generateInsights", () => {
  it("always includes a deciding-factor, confidence, and trust score explanation", () => {
    const input = baseInput();
    const insights = generateInsights(input, generateKeyFactors(input));

    expect(insights.map((i) => i.id)).toContain("deciding-factor");
    expect(insights.map((i) => i.id)).toContain("confidence-explanation");
    expect(insights.map((i) => i.id)).toContain("trust-score-explanation");
  });

  it("omits a weakness insight when the winner leads in every measured dimension", () => {
    const winnerDna = dna("sen", { aggression: 90, tempo: 80 });
    const loserDna = dna("loud", { aggression: 40, tempo: 30 });
    const input = baseInput({ winnerDna, loserDna });

    const insights = generateInsights(input, generateKeyFactors(input));

    expect(insights.some((i) => i.kind === "weakness" && i.id === "biggest-weakness")).toBe(false);
  });

  it("sources the confidence explanation from the real computed inputs, not a generic string", () => {
    const input = baseInput({ confidence: 73, dimensionAgreement: 0.65, formStability: 0.42 });
    const insights = generateInsights(input, generateKeyFactors(input));

    const explanation = insights.find((i) => i.id === "confidence-explanation");
    expect(explanation?.description).toContain("73%");
    expect(explanation?.description).toContain("65%");
    expect(explanation?.description).toContain("42%");
  });

  it("sources the trust score explanation from the real computed inputs, not a generic string", () => {
    const input = baseInput({ trustScore: 61, featureCoverage: 0.83, confidence: 55 });
    const insights = generateInsights(input, generateKeyFactors(input));

    const explanation = insights.find((i) => i.id === "trust-score-explanation");
    expect(explanation?.description).toContain("61%");
    expect(explanation?.description).toContain("83%");
    expect(explanation?.description).toContain("55%");
  });

  it("includes a head-to-head insight when history exists between the two teams", () => {
    const headToHead: HeadToHeadRecord = {
      teamAId: winner.id,
      teamBId: loser.id,
      matchesPlayed: 5,
      teamAWins: 3,
      teamBWins: 2,
      teamAWinRate: 0.6,
      averageRoundDifferential: 2,
    };
    const input = baseInput({ headToHead });
    const insights = generateInsights(input, generateKeyFactors(input));

    const headToHeadInsight = insights.find((i) => i.id === "head-to-head");
    expect(headToHeadInsight).toBeDefined();
    expect(headToHeadInsight?.kind).toBe("advantage");
    expect(headToHeadInsight?.description).toContain("3");
    expect(headToHeadInsight?.description).toContain("5");
    expect(headToHeadInsight?.description).toContain(winner.name);
    expect(headToHeadInsight?.description).toContain(loser.name);
  });

  it("marks the head-to-head insight as a weakness when the winner trails in prior meetings", () => {
    const headToHead: HeadToHeadRecord = {
      teamAId: winner.id,
      teamBId: loser.id,
      matchesPlayed: 5,
      teamAWins: 1,
      teamBWins: 4,
      teamAWinRate: 0.2,
      averageRoundDifferential: -3,
    };
    const input = baseInput({ headToHead });
    const insights = generateInsights(input, generateKeyFactors(input));

    expect(insights.find((i) => i.id === "head-to-head")?.kind).toBe("weakness");
  });

  it("does not fabricate a head-to-head insight when no history exists", () => {
    const input = baseInput({ headToHead: null });
    const insights = generateInsights(input, generateKeyFactors(input));

    expect(insights.some((i) => i.id === "head-to-head")).toBe(false);
  });

  it("includes a recent-form insight referencing both teams when data exists", () => {
    const winnerRecentForm: FormWindow = { matchesConsidered: 5, wins: 4, winRate: 0.8 };
    const loserRecentForm: FormWindow = { matchesConsidered: 5, wins: 2, winRate: 0.4 };
    const input = baseInput({ winnerRecentForm, loserRecentForm });
    const insights = generateInsights(input, generateKeyFactors(input));

    const recentFormInsight = insights.find((i) => i.id === "recent-form");
    expect(recentFormInsight).toBeDefined();
    expect(recentFormInsight?.kind).toBe("advantage");
    expect(recentFormInsight?.description).toContain(winner.name);
    expect(recentFormInsight?.description).toContain(loser.name);
    expect(recentFormInsight?.description).toContain("80%");
    expect(recentFormInsight?.description).toContain("40%");
  });

  it("does not fabricate a recent-form insight when either team lacks sufficient recent matches", () => {
    const input = baseInput({ winnerRecentForm: noRecentForm, loserRecentForm: noRecentForm });
    const insights = generateInsights(input, generateKeyFactors(input));

    expect(insights.some((i) => i.id === "recent-form")).toBe(false);
  });
});
