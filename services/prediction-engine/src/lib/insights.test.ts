import { describe, expect, it } from "vitest";
import type { MatchDna, Team, TeamDna } from "@repo/shared";
import { generateInsights, generateKeyFactors } from "./insights";

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

describe("generateKeyFactors", () => {
  it("marks factors favoring the winner as positive and the rest negative", () => {
    const winnerDna = dna("sen", { aggression: 90, mapControl: 30 });
    const loserDna = dna("loud", { aggression: 40, mapControl: 70 });

    const factors = generateKeyFactors({ winner, loser, winnerDna, loserDna, matchDna, confidence: 80, trustScore: 90 });

    const aggressionFactor = factors.find((f) => f.id === "aggression");
    const mapControlFactor = factors.find((f) => f.id === "mapControl");

    expect(aggressionFactor?.impact).toBe("positive");
    expect(mapControlFactor?.impact).toBe("negative");
  });

  it("filters out near-equal dimensions and sorts by magnitude descending", () => {
    const winnerDna = dna("sen", { aggression: 90, tempo: 51 });
    const loserDna = dna("loud", { aggression: 40, tempo: 50 });

    const factors = generateKeyFactors({ winner, loser, winnerDna, loserDna, matchDna, confidence: 80, trustScore: 90 });

    expect(factors.map((f) => f.id)).toEqual(["aggression"]);
  });
});

describe("generateInsights", () => {
  it("always includes a deciding-factor and confidence insight", () => {
    const winnerDna = dna("sen", { aggression: 90 });
    const loserDna = dna("loud", { aggression: 40 });
    const input = { winner, loser, winnerDna, loserDna, matchDna, confidence: 80, trustScore: 90 };

    const insights = generateInsights(input, generateKeyFactors(input));

    expect(insights.map((i) => i.kind)).toContain("deciding-factor");
    expect(insights.map((i) => i.kind)).toContain("confidence");
  });

  it("omits a weakness insight when the winner leads in every measured dimension", () => {
    const winnerDna = dna("sen", { aggression: 90, tempo: 80 });
    const loserDna = dna("loud", { aggression: 40, tempo: 30 });
    const input = { winner, loser, winnerDna, loserDna, matchDna, confidence: 80, trustScore: 90 };

    const insights = generateInsights(input, generateKeyFactors(input));

    expect(insights.some((i) => i.kind === "weakness")).toBe(false);
  });
});
