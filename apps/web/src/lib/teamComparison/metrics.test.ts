import { describe, expect, it } from "vitest";
import { buildOverviewMetrics, compareDnaDimensions, OVERVIEW_METRIC_DEFINITIONS } from "./metrics";
import { buildProfileFixture } from "./testFixtures";

describe("buildOverviewMetrics", () => {
  it("produces one metric per defined key, in order", () => {
    const metrics = buildOverviewMetrics(buildProfileFixture(), buildProfileFixture());
    expect(metrics.map((metric) => metric.key)).toEqual(OVERVIEW_METRIC_DEFINITIONS.map((def) => def.key));
  });

  it("carries the raw values through untouched", () => {
    const profileA = buildProfileFixture({ overallRating: 82 });
    const profileB = buildProfileFixture({ overallRating: 74 });
    const metrics = buildOverviewMetrics(profileA, profileB);
    const overall = metrics.find((metric) => metric.key === "overallRating")!;
    expect(overall.valueA).toBe(82);
    expect(overall.valueB).toBe(74);
    expect(overall.advantage).toBe("A");
  });

  it("treats identical profiles as even across every metric — no NaN, no false winner", () => {
    const profile = buildProfileFixture();
    const metrics = buildOverviewMetrics(profile, profile);
    for (const metric of metrics) {
      expect(metric.advantage).toBe("even");
      expect(metric.tier).toBe("none");
      expect(Number.isNaN(metric.magnitude)).toBe(false);
    }
  });

  it("uses the narrower round-differential band so a 1-round gap is not silently 'even'", () => {
    const profileA = buildProfileFixture({ roundDifferential: 2 });
    const profileB = buildProfileFixture({ roundDifferential: 0.5 });
    const metrics = buildOverviewMetrics(profileA, profileB);
    const roundDiff = metrics.find((metric) => metric.key === "roundDifferential")!;
    expect(roundDiff.tier).not.toBe("none");
  });

  it("is deterministic for the same input", () => {
    const profileA = buildProfileFixture({ overallRating: 77 });
    const profileB = buildProfileFixture({ overallRating: 61 });
    expect(buildOverviewMetrics(profileA, profileB)).toEqual(buildOverviewMetrics(profileA, profileB));
  });
});

describe("compareDnaDimensions", () => {
  const dnaA = buildProfileFixture().dna;
  const dnaB = buildProfileFixture({
    dna: {
      teamId: "b",
      dimensions: [
        { key: "aggression", label: "Aggression", value: 40 },
        { key: "tempo", label: "Tempo", value: 65 },
        { key: "mapControl", label: "Map Control", value: 60 },
        { key: "utilityEfficiency", label: "Utility Efficiency", value: 68 },
        { key: "adaptability", label: "Adaptability", value: 62 },
        { key: "clutchAbility", label: "Clutch Ability", value: 66 },
      ],
    },
  }).dna;

  it("produces one row per dimension in Team A's order", () => {
    const rows = compareDnaDimensions(dnaA, dnaB);
    expect(rows.map((row) => row.key)).toEqual(dnaA.dimensions.map((dimension) => dimension.key));
  });

  it("flags the differing dimension and leaves matching ones even", () => {
    const rows = compareDnaDimensions(dnaA, dnaB);
    const aggression = rows.find((row) => row.key === "aggression")!;
    const tempo = rows.find((row) => row.key === "tempo")!;
    expect(aggression.advantage).toBe("A");
    expect(tempo.advantage).toBe("even");
  });

  it("defaults a missing dimension in Team B to 0 rather than crashing", () => {
    const incomplete = { teamId: "b", dimensions: dnaB.dimensions.slice(1) };
    const rows = compareDnaDimensions(dnaA, incomplete);
    const aggression = rows.find((row) => row.key === "aggression")!;
    expect(aggression.valueB).toBe(0);
    expect(Number.isNaN(aggression.magnitude)).toBe(false);
  });
});
