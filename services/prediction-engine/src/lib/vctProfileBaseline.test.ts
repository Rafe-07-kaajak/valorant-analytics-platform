import { describe, expect, it } from "vitest";
import { getVctProfileBaseline } from "./vctProfileBaseline";
import { getVctTeamProfile } from "./vctTeamProfiles";

describe("getVctProfileBaseline", () => {
  it("projects exactly the twelve adjustable fields plus mapStrength", () => {
    const baseline = getVctProfileBaseline("paper-rex", ["ascent", "haven"])!;
    expect(Object.keys(baseline).sort()).toEqual(
      [
        "adaptability",
        "aggression",
        "attackStrength",
        "clutchAbility",
        "clutchPerformance",
        "consistency",
        "defenseStrength",
        "economyEfficiency",
        "mapControl",
        "mapStrength",
        "recentFormIndex",
        "tempo",
        "utilityEfficiency",
      ].sort(),
    );
  });

  it("never exposes teamId, region, archetype, overallRating, or roundDifferential", () => {
    const baseline = getVctProfileBaseline("paper-rex", []) as unknown as Record<string, unknown>;
    for (const forbidden of ["teamId", "region", "archetype", "overallRating", "roundDifferential"]) {
      expect(forbidden in baseline).toBe(false);
    }
  });

  it("matches the underlying profile's values exactly", () => {
    const profile = getVctTeamProfile("paper-rex")!;
    const baseline = getVctProfileBaseline("paper-rex", ["ascent"])!;
    expect(baseline.attackStrength).toBe(profile.attackStrength);
    expect(baseline.recentFormIndex).toBe(profile.recentFormIndex);
    expect(baseline.aggression).toBe(profile.dna.dimensions.find((d) => d.key === "aggression")!.value);
    expect(baseline.mapStrength.ascent).toBe(profile.mapStrength.ascent);
  });

  it("restricts mapStrength to only the requested map ids", () => {
    const baseline = getVctProfileBaseline("paper-rex", ["ascent"])!;
    expect(Object.keys(baseline.mapStrength)).toEqual(["ascent"]);
  });

  it("returns an empty mapStrength for an empty map id list", () => {
    const baseline = getVctProfileBaseline("paper-rex", [])!;
    expect(baseline.mapStrength).toEqual({});
  });

  it("returns undefined for an unknown team", () => {
    expect(getVctProfileBaseline("not-a-real-team" as never, [])).toBeUndefined();
  });
});
