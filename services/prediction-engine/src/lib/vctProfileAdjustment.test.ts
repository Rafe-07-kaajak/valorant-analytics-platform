import { describe, expect, it } from "vitest";
import { createEmptyVctProfileAdjustment } from "@repo/shared";
import {
  applyDnaDelta,
  applyMapStrengthDelta,
  applyScalarDelta,
  applyVctProfileAdjustment,
  cloneVctTeamProfile,
} from "./vctProfileAdjustment";
import { getVctTeamProfile } from "./vctTeamProfiles";

const baseline = getVctTeamProfile("paper-rex")!;

describe("cloneVctTeamProfile", () => {
  it("produces a deeply separate object — mutating the clone's nested fields never touches the baseline", () => {
    const clone = cloneVctTeamProfile(baseline);
    expect(clone).not.toBe(baseline);
    expect(clone.dna).not.toBe(baseline.dna);
    expect(clone.dna.dimensions).not.toBe(baseline.dna.dimensions);
    expect(clone.dna.dimensions[0]).not.toBe(baseline.dna.dimensions[0]);
    expect(clone.mapStrength).not.toBe(baseline.mapStrength);
    expect(clone).toEqual(baseline);
  });
});

describe("applyScalarDelta", () => {
  it("adds the delta and clamps to the 0-100 scale", () => {
    const result = applyScalarDelta(baseline, "attackStrength", 5);
    expect(result.attackStrength).toBe(Math.min(100, Math.round(baseline.attackStrength + 5)));
  });

  it("clamps at 100 for a large positive delta", () => {
    const result = applyScalarDelta(baseline, "attackStrength", 15);
    expect(result.attackStrength).toBeLessThanOrEqual(100);
  });

  it("clamps at 0 for a large negative delta", () => {
    const result = applyScalarDelta(baseline, "attackStrength", -15);
    expect(result.attackStrength).toBeGreaterThanOrEqual(0);
  });

  it("never mutates the baseline profile", () => {
    const before = baseline.attackStrength;
    applyScalarDelta(baseline, "attackStrength", 10);
    expect(baseline.attackStrength).toBe(before);
  });
});

describe("applyDnaDelta", () => {
  it("adjusts only the targeted dimension", () => {
    const result = applyDnaDelta(baseline, "aggression", 5);
    const before = baseline.dna.dimensions.find((d) => d.key === "aggression")!.value;
    const after = result.dna.dimensions.find((d) => d.key === "aggression")!.value;
    expect(after).toBe(Math.min(100, Math.round(before + 5)));

    for (const dimension of result.dna.dimensions) {
      if (dimension.key === "aggression") continue;
      const original = baseline.dna.dimensions.find((d) => d.key === dimension.key)!;
      expect(dimension.value).toBe(original.value);
    }
  });

  it("clamps to [0, 100]", () => {
    const high = applyDnaDelta(baseline, "tempo", 15);
    const low = applyDnaDelta(baseline, "tempo", -15);
    expect(high.dna.dimensions.find((d) => d.key === "tempo")!.value).toBeLessThanOrEqual(100);
    expect(low.dna.dimensions.find((d) => d.key === "tempo")!.value).toBeGreaterThanOrEqual(0);
  });

  it("never mutates the baseline profile's dimensions", () => {
    const before = baseline.dna.dimensions.map((d) => d.value);
    applyDnaDelta(baseline, "aggression", 10);
    expect(baseline.dna.dimensions.map((d) => d.value)).toEqual(before);
  });
});

describe("applyMapStrengthDelta", () => {
  it("adjusts only the targeted map", () => {
    const result = applyMapStrengthDelta(baseline, "ascent", 5);
    expect(result.mapStrength.ascent).toBe(Math.min(100, Math.round(baseline.mapStrength.ascent! + 5)));
    expect(result.mapStrength.haven).toBe(baseline.mapStrength.haven);
  });

  it("is a no-op for a map id absent from the profile", () => {
    const result = applyMapStrengthDelta(baseline, "not-a-real-map", 10);
    expect(result.mapStrength).toEqual(baseline.mapStrength);
  });

  it("clamps to [0, 100]", () => {
    const result = applyMapStrengthDelta(baseline, "ascent", 15);
    expect(result.mapStrength.ascent).toBeLessThanOrEqual(100);
  });
});

describe("applyVctProfileAdjustment", () => {
  it("returns a profile identical to the baseline when the adjustment is empty", () => {
    const result = applyVctProfileAdjustment(baseline, createEmptyVctProfileAdjustment());
    expect(result).toEqual(baseline);
    expect(result).not.toBe(baseline);
  });

  it("applies scalar, dna, and mapStrength deltas together", () => {
    const result = applyVctProfileAdjustment(baseline, {
      scalar: { attackStrength: 5 },
      dna: { aggression: -5 },
      mapStrength: { ascent: 5 },
    });

    expect(result.attackStrength).toBe(Math.min(100, Math.max(0, Math.round(baseline.attackStrength + 5))));
    expect(result.dna.dimensions.find((d) => d.key === "aggression")!.value).toBe(
      Math.min(100, Math.max(0, Math.round(baseline.dna.dimensions.find((d) => d.key === "aggression")!.value - 5))),
    );
    expect(result.mapStrength.ascent).toBe(Math.min(100, Math.max(0, Math.round(baseline.mapStrength.ascent! + 5))));
  });

  it("is deterministic for the same profile and adjustment", () => {
    const adjustment = { scalar: { consistency: 3 }, dna: { tempo: -2 }, mapStrength: { bind: 4 } };
    const first = applyVctProfileAdjustment(baseline, adjustment);
    const second = applyVctProfileAdjustment(baseline, adjustment);
    expect(first).toEqual(second);
  });

  it("never mutates the baseline profile, even under a large combined adjustment", () => {
    const before = JSON.parse(JSON.stringify(baseline));
    applyVctProfileAdjustment(baseline, {
      scalar: { attackStrength: 15, defenseStrength: -15, economyEfficiency: 10, clutchPerformance: -10, consistency: 5, recentFormIndex: -5 },
      dna: { aggression: 15, tempo: -15, mapControl: 10, utilityEfficiency: -10, adaptability: 5, clutchAbility: -5 },
      mapStrength: { ascent: 15, haven: -15 },
    });
    expect(JSON.parse(JSON.stringify(baseline))).toEqual(before);
  });
});
