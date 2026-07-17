import { describe, expect, it } from "vitest";
import { buildSupportingMetrics, explainMapMatchup } from "./explanation";
import { buildProfileFixture } from "../teamComparison/testFixtures";
import type { MapComparisonRow } from "../teamComparison";

const TEAM_A = "Paper Rex";
const TEAM_B = "G2 Esports";

function mapRow(overrides: Partial<MapComparisonRow>): MapComparisonRow {
  return {
    mapId: "ascent",
    mapName: "Ascent",
    scoreA: 60,
    scoreB: 60,
    advantage: "even",
    tier: "none",
    magnitude: 0,
    ...overrides,
  };
}

describe("buildSupportingMetrics", () => {
  it("covers all nine tracked metrics with no NaN", () => {
    const metrics = buildSupportingMetrics(buildProfileFixture(), buildProfileFixture({ overallRating: 40 }));
    expect(metrics).toHaveLength(9);
    for (const metric of metrics) {
      expect(Number.isNaN(metric.magnitude)).toBe(false);
    }
  });

  it("defaults a missing DNA dimension to 0 rather than throwing", () => {
    const incomplete = buildProfileFixture({
      dna: { teamId: "a", dimensions: [{ key: "aggression", label: "Aggression", value: 70 }] },
    });
    expect(() => buildSupportingMetrics(incomplete, buildProfileFixture())).not.toThrow();
    const metrics = buildSupportingMetrics(incomplete, buildProfileFixture());
    const tempo = metrics.find((metric) => metric.key === "tempo")!;
    expect(tempo.valueA).toBe(0);
    expect(Number.isNaN(tempo.magnitude)).toBe(false);
  });
});

describe("explainMapMatchup", () => {
  it("produces a Team A edge explanation naming Team A as the leader", () => {
    const row = mapRow({ scoreA: 75, scoreB: 55, advantage: "A", tier: "moderate", magnitude: 20 });
    const profileA = buildProfileFixture({ attackStrength: 85 });
    const profileB = buildProfileFixture({ attackStrength: 50 });
    const explanation = explainMapMatchup(row, profileA, profileB, TEAM_A, TEAM_B);

    expect(explanation).toContain("Ascent");
    expect(explanation).toContain(`${TEAM_A} edge`);
    expect(explanation.split(". ").length).toBeGreaterThanOrEqual(2);
  });

  it("produces a Team B edge explanation naming Team B as the leader", () => {
    const row = mapRow({ scoreA: 45, scoreB: 70, advantage: "B", tier: "slight", magnitude: 6 });
    const explanation = explainMapMatchup(row, buildProfileFixture(), buildProfileFixture(), TEAM_A, TEAM_B);
    expect(explanation).toContain(`${TEAM_B} edge`);
  });

  it("supports a close/even map without declaring a winner", () => {
    const row = mapRow({ scoreA: 61, scoreB: 60, advantage: "even", tier: "none", magnitude: 1 });
    const explanation = explainMapMatchup(row, buildProfileFixture(), buildProfileFixture(), TEAM_A, TEAM_B);
    expect(explanation.toLowerCase()).toContain("close matchup");
    expect(explanation).not.toContain(`${TEAM_A} edge`);
    expect(explanation).not.toContain(`${TEAM_B} edge`);
  });

  it("never uses causal, official-data, percentage, or scoreline language", () => {
    const row = mapRow({ scoreA: 80, scoreB: 40, advantage: "A", tier: "strong", magnitude: 40 });
    const explanation = explainMapMatchup(row, buildProfileFixture(), buildProfileFixture(), TEAM_A, TEAM_B);
    for (const forbidden of ["%", "causes", "will win", "official", "13-", "score of"]) {
      expect(explanation.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("handles a profile with a missing DNA dimension without crashing or producing NaN text", () => {
    const incomplete = buildProfileFixture({
      dna: { teamId: "a", dimensions: [] },
    });
    const row = mapRow({ scoreA: 70, scoreB: 50, advantage: "A", tier: "moderate", magnitude: 20 });
    const explanation = explainMapMatchup(row, incomplete, buildProfileFixture(), TEAM_A, TEAM_B);
    expect(explanation).not.toContain("NaN");
    expect(explanation.length).toBeGreaterThan(0);
  });

  it("stays within roughly 2-4 sentences", () => {
    const row = mapRow({ scoreA: 75, scoreB: 55, advantage: "A", tier: "moderate", magnitude: 20 });
    const explanation = explainMapMatchup(row, buildProfileFixture(), buildProfileFixture(), TEAM_A, TEAM_B);
    const sentenceCount = explanation.split(/(?<=[.!?])\s+/).filter(Boolean).length;
    expect(sentenceCount).toBeGreaterThanOrEqual(2);
    expect(sentenceCount).toBeLessThanOrEqual(4);
  });

  it("is deterministic for the same input", () => {
    const row = mapRow({ scoreA: 75, scoreB: 55, advantage: "A", tier: "moderate", magnitude: 20 });
    const profileA = buildProfileFixture();
    const profileB = buildProfileFixture({ overallRating: 55 });
    expect(explainMapMatchup(row, profileA, profileB, TEAM_A, TEAM_B)).toBe(
      explainMapMatchup(row, profileA, profileB, TEAM_A, TEAM_B),
    );
  });
});
