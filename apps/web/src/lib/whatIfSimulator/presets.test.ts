import { describe, expect, it } from "vitest";
import { createEmptyTeamDraft, setAttributeDelta } from "./draftState";
import { applyPresetToDraft, getSimulationPreset, SIMULATION_PRESETS } from "./presets";

describe("SIMULATION_PRESETS", () => {
  it("defines exactly the six required presets", () => {
    expect(SIMULATION_PRESETS.map((preset) => preset.label)).toEqual([
      "Improved Form",
      "Stronger Defense",
      "Better Economy",
      "Clutch Boost",
      "Aggressive Style",
      "Balanced Upgrade",
    ]);
  });

  it("every preset's deltas are non-empty and within bounds", () => {
    for (const preset of SIMULATION_PRESETS) {
      const values = Object.values(preset.deltas);
      expect(values.length).toBeGreaterThan(0);
      for (const value of values) {
        expect(value).toBeGreaterThanOrEqual(-15);
        expect(value).toBeLessThanOrEqual(15);
      }
    }
  });

  it("no preset's description claims a guaranteed outcome, roster transfer, injury, or coaching change", () => {
    const forbidden = /guarantee|transfer|injury|coach/i;
    for (const preset of SIMULATION_PRESETS) {
      expect(preset.description).not.toMatch(forbidden);
    }
  });
});

describe("getSimulationPreset", () => {
  it("finds a preset by id", () => {
    expect(getSimulationPreset("improved-form")?.label).toBe("Improved Form");
  });

  it("returns undefined for an unknown id", () => {
    expect(getSimulationPreset("not-a-real-preset")).toBeUndefined();
  });
});

describe("applyPresetToDraft", () => {
  it("overwrites only the fields the preset names", () => {
    const draft = setAttributeDelta(createEmptyTeamDraft(), "tempo", 9);
    const preset = getSimulationPreset("improved-form")!;
    const result = applyPresetToDraft(draft, preset);

    expect(result.recentFormIndex).toBe(preset.deltas.recentFormIndex);
    expect(result.consistency).toBe(preset.deltas.consistency);
    // A field the user had already adjusted, which this preset doesn't touch, is preserved.
    expect(result.tempo).toBe(9);
  });

  it("is idempotent — applying the same preset twice matches applying it once", () => {
    const preset = getSimulationPreset("aggressive-style")!;
    const once = applyPresetToDraft(createEmptyTeamDraft(), preset);
    const twice = applyPresetToDraft(once, preset);
    expect(twice).toEqual(once);
  });

  it("a later preset overrides an earlier preset's overlapping fields", () => {
    const stronger = getSimulationPreset("stronger-defense")!;
    const economy = getSimulationPreset("better-economy")!;
    let draft = applyPresetToDraft(createEmptyTeamDraft(), stronger);
    draft = applyPresetToDraft(draft, economy);

    // Both presets touch utilityEfficiency — the later preset wins deterministically.
    expect(draft.utilityEfficiency).toBe(economy.deltas.utilityEfficiency);
    // stronger-defense's non-overlapping field survives.
    expect(draft.defenseStrength).toBe(stronger.deltas.defenseStrength);
  });
});
