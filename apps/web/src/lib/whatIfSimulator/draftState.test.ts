import { describe, expect, it } from "vitest";
import {
  clampDeltaValue,
  createEmptyMapDraft,
  createEmptyTeamDraft,
  fromProfileAdjustment,
  hasAnyAdjustments,
  mapDraftHasAdjustments,
  resetAttributeDelta,
  resetMapDelta,
  setAttributeDelta,
  setMapDelta,
  teamDraftHasAdjustments,
  toProfileAdjustment,
} from "./draftState";
import { ATTRIBUTE_CONTROLS } from "./types";

describe("createEmptyTeamDraft", () => {
  it("populates every attribute control at zero", () => {
    const draft = createEmptyTeamDraft();
    expect(Object.keys(draft)).toHaveLength(ATTRIBUTE_CONTROLS.length);
    expect(Object.values(draft).every((value) => value === 0)).toBe(true);
  });
});

describe("createEmptyMapDraft", () => {
  it("populates every given map id at zero", () => {
    const draft = createEmptyMapDraft(["ascent", "haven"]);
    expect(draft).toEqual({ ascent: 0, haven: 0 });
  });

  it("produces an empty object for no maps", () => {
    expect(createEmptyMapDraft([])).toEqual({});
  });
});

describe("clampDeltaValue", () => {
  it("clamps above the max", () => {
    expect(clampDeltaValue(30)).toBe(15);
  });

  it("clamps below the min", () => {
    expect(clampDeltaValue(-30)).toBe(-15);
  });

  it("rounds to the nearest integer step", () => {
    expect(clampDeltaValue(4.6)).toBe(5);
  });

  it("treats NaN as zero", () => {
    expect(clampDeltaValue(NaN)).toBe(0);
  });

  it("treats Infinity as clamped to the bound, not left infinite", () => {
    expect(clampDeltaValue(Infinity)).toBe(0);
  });
});

describe("setAttributeDelta / resetAttributeDelta", () => {
  it("sets one attribute without touching others", () => {
    const draft = setAttributeDelta(createEmptyTeamDraft(), "aggression", 7);
    expect(draft.aggression).toBe(7);
    expect(draft.tempo).toBe(0);
  });

  it("clamps when setting", () => {
    const draft = setAttributeDelta(createEmptyTeamDraft(), "aggression", 100);
    expect(draft.aggression).toBe(15);
  });

  it("resets one attribute back to zero", () => {
    const withValue = setAttributeDelta(createEmptyTeamDraft(), "aggression", 7);
    const reset = resetAttributeDelta(withValue, "aggression");
    expect(reset.aggression).toBe(0);
  });
});

describe("setMapDelta / resetMapDelta", () => {
  it("sets and resets a single map's delta", () => {
    const draft = setMapDelta(createEmptyMapDraft(["ascent"]), "ascent", 5);
    expect(draft.ascent).toBe(5);
    expect(resetMapDelta(draft, "ascent").ascent).toBe(0);
  });
});

describe("has-adjustments detection", () => {
  it("is false for an all-zero draft", () => {
    expect(teamDraftHasAdjustments(createEmptyTeamDraft())).toBe(false);
    expect(mapDraftHasAdjustments(createEmptyMapDraft(["ascent"]))).toBe(false);
  });

  it("is true once any single value is non-zero", () => {
    expect(teamDraftHasAdjustments(setAttributeDelta(createEmptyTeamDraft(), "tempo", 1))).toBe(true);
    expect(mapDraftHasAdjustments(setMapDelta(createEmptyMapDraft(["ascent"]), "ascent", 1))).toBe(true);
  });

  it("hasAnyAdjustments is true if any of the four drafts has a change", () => {
    const empty = createEmptyTeamDraft();
    const emptyMap = createEmptyMapDraft(["ascent"]);
    expect(hasAnyAdjustments(empty, empty, emptyMap, emptyMap)).toBe(false);
    expect(hasAnyAdjustments(setAttributeDelta(empty, "tempo", 1), empty, emptyMap, emptyMap)).toBe(true);
    expect(hasAnyAdjustments(empty, empty, setMapDelta(emptyMap, "ascent", 1), emptyMap)).toBe(true);
  });
});

describe("toProfileAdjustment", () => {
  it("produces an empty payload for an all-zero draft", () => {
    const result = toProfileAdjustment(createEmptyTeamDraft(), createEmptyMapDraft(["ascent"]));
    expect(result).toEqual({ scalar: {}, dna: {}, mapStrength: {} });
  });

  it("routes dna-kind controls into `dna` and scalar-kind controls into `scalar`", () => {
    let draft = createEmptyTeamDraft();
    draft = setAttributeDelta(draft, "aggression", 5);
    draft = setAttributeDelta(draft, "attackStrength", -4);

    const result = toProfileAdjustment(draft, createEmptyMapDraft([]));
    expect(result.dna).toEqual({ aggression: 5 });
    expect(result.scalar).toEqual({ attackStrength: -4 });
  });

  it("omits zero entries entirely (never present as an explicit 0)", () => {
    const draft = setAttributeDelta(createEmptyTeamDraft(), "tempo", 0);
    const result = toProfileAdjustment(draft, createEmptyMapDraft([]));
    expect(result.dna).toEqual({});
    expect("tempo" in result.dna).toBe(false);
  });

  it("carries non-zero map deltas through", () => {
    const mapDraft = setMapDelta(createEmptyMapDraft(["ascent", "haven"]), "ascent", 6);
    const result = toProfileAdjustment(createEmptyTeamDraft(), mapDraft);
    expect(result.mapStrength).toEqual({ ascent: 6 });
  });
});

describe("fromProfileAdjustment", () => {
  it("is the inverse of toProfileAdjustment for a non-empty draft", () => {
    let draft = createEmptyTeamDraft();
    draft = setAttributeDelta(draft, "aggression", 5);
    draft = setAttributeDelta(draft, "attackStrength", -4);

    const wire = toProfileAdjustment(draft, createEmptyMapDraft([]));
    const roundTripped = fromProfileAdjustment(wire);
    expect(roundTripped).toEqual(draft);
  });

  it("produces an all-zero draft for an empty adjustment", () => {
    expect(fromProfileAdjustment({ scalar: {}, dna: {}, mapStrength: {} })).toEqual(createEmptyTeamDraft());
  });
});
