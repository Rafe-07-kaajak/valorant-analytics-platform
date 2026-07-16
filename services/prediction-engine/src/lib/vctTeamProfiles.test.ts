import { describe, expect, it } from "vitest";
import { maps } from "../data/maps";
import { VCT_TEAM_IDENTITIES, type VctTeamId } from "../data/vctTeams";
import { DNA_DIMENSIONS } from "./teamDna";
import {
  VCT_TEAM_PROFILES,
  generateVctTeamProfiles,
  getStrongestVctMap,
  getVctMapStrength,
  getVctTeamProfile,
  getVctTeamProfilesByRegion,
  getWeakestVctMap,
} from "./vctTeamProfiles";

const ALL_TEAM_IDS = VCT_TEAM_IDENTITIES.map((identity) => identity.id);
const PERCENT_FIELDS = [
  "overallRating",
  "attackStrength",
  "defenseStrength",
  "economyEfficiency",
  "clutchPerformance",
  "consistency",
  "mapControl",
  "recentFormIndex",
] as const;

function isFinitePercent(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

describe("VCT_TEAM_PROFILES coverage", () => {
  it("has exactly 32 profiles", () => {
    expect(VCT_TEAM_PROFILES).toHaveLength(32);
  });

  it("includes every TASK-030-aligned team id exactly once", () => {
    const ids = VCT_TEAM_PROFILES.map((profile) => profile.teamId).sort();
    expect(ids).toEqual([...ALL_TEAM_IDS].sort());
    expect(new Set(ids).size).toBe(32);
  });

  it("has no duplicate team ids", () => {
    const ids = VCT_TEAM_PROFILES.map((profile) => profile.teamId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("groups into exactly 8 teams per region", () => {
    for (const region of ["americas", "emea", "pacific", "china"] as const) {
      expect(getVctTeamProfilesByRegion(region)).toHaveLength(8);
    }
  });

  it("is frozen (readonly) at runtime", () => {
    expect(Object.isFrozen(VCT_TEAM_PROFILES)).toBe(true);
    expect(Object.isFrozen(VCT_TEAM_PROFILES[0])).toBe(true);
    expect(Object.isFrozen(VCT_TEAM_PROFILES[0]?.mapStrength)).toBe(true);
  });
});

describe("VCT_TEAM_PROFILES determinism", () => {
  it("produces identical output across repeated generation calls", () => {
    expect(generateVctTeamProfiles()).toEqual(generateVctTeamProfiles());
  });

  it("matches the precomputed constant", () => {
    expect(generateVctTeamProfiles()).toEqual(VCT_TEAM_PROFILES);
  });
});

describe("VCT_TEAM_PROFILES numeric bounds", () => {
  it("keeps every percent field within [0, 100] and finite for every team", () => {
    for (const profile of VCT_TEAM_PROFILES) {
      for (const field of PERCENT_FIELDS) {
        expect(isFinitePercent(profile[field]), `${profile.teamId}.${field}`).toBe(true);
      }
    }
  });

  it("keeps round differential within [-8, 8] and finite for every team", () => {
    for (const profile of VCT_TEAM_PROFILES) {
      expect(Number.isFinite(profile.roundDifferential)).toBe(true);
      expect(Math.abs(profile.roundDifferential)).toBeLessThanOrEqual(8);
    }
  });
});

describe("VCT_TEAM_PROFILES map coverage", () => {
  it("every team has modeled strength for every supported map", () => {
    for (const profile of VCT_TEAM_PROFILES) {
      for (const map of maps) {
        expect(profile.mapStrength[map.id]).toBeDefined();
        expect(isFinitePercent(profile.mapStrength[map.id]!)).toBe(true);
      }
      expect(Object.keys(profile.mapStrength)).toHaveLength(maps.length);
    }
  });

  it("getVctMapStrength returns the same value as the profile's own record", () => {
    for (const profile of VCT_TEAM_PROFILES) {
      for (const map of maps) {
        expect(getVctMapStrength(profile.teamId, map.id)).toBe(profile.mapStrength[map.id]);
      }
    }
  });

  it("getStrongestVctMap and getWeakestVctMap are defined and consistent for every team", () => {
    for (const profile of VCT_TEAM_PROFILES) {
      const strongest = getStrongestVctMap(profile.teamId);
      const weakest = getWeakestVctMap(profile.teamId);
      expect(strongest).toBeDefined();
      expect(weakest).toBeDefined();
      expect(strongest!.strength).toBeGreaterThanOrEqual(weakest!.strength);
      expect(profile.mapStrength[strongest!.mapId]).toBe(strongest!.strength);
      expect(profile.mapStrength[weakest!.mapId]).toBe(weakest!.strength);
    }
  });

  it("returns undefined for an unknown team", () => {
    expect(getStrongestVctMap("not-a-real-team" as VctTeamId)).toBeUndefined();
    expect(getWeakestVctMap("not-a-real-team" as VctTeamId)).toBeUndefined();
    expect(getVctMapStrength("not-a-real-team" as VctTeamId, "ascent")).toBeUndefined();
  });
});

describe("VCT_TEAM_PROFILES derived Team DNA", () => {
  it("every profile's DNA is keyed to its own team id", () => {
    for (const profile of VCT_TEAM_PROFILES) {
      expect(profile.dna.teamId).toBe(profile.teamId);
    }
  });

  it("every profile's DNA has exactly the registered dimensions, each within bounds", () => {
    for (const profile of VCT_TEAM_PROFILES) {
      expect(profile.dna.dimensions).toHaveLength(DNA_DIMENSIONS.length);
      const keys = profile.dna.dimensions.map((dimension) => dimension.key).sort();
      expect(keys).toEqual([...DNA_DIMENSIONS.map((d) => d.key)].sort());
      for (const dimension of profile.dna.dimensions) {
        expect(isFinitePercent(dimension.value)).toBe(true);
      }
    }
  });

  it("aliases (economyEfficiency, clutchPerformance, consistency, mapControl) match their DNA dimensions", () => {
    for (const profile of VCT_TEAM_PROFILES) {
      const dimensionValue = (key: string) => profile.dna.dimensions.find((d) => d.key === key)!.value;
      expect(profile.economyEfficiency).toBe(dimensionValue("utilityEfficiency"));
      expect(profile.clutchPerformance).toBe(dimensionValue("clutchAbility"));
      expect(profile.consistency).toBe(dimensionValue("adaptability"));
      expect(profile.mapControl).toBe(dimensionValue("mapControl"));
    }
  });
});

describe("VCT_TEAM_PROFILES differentiation", () => {
  it("does not assign every team an identical overall rating", () => {
    const ratings = new Set(VCT_TEAM_PROFILES.map((profile) => profile.overallRating));
    expect(ratings.size).toBeGreaterThan(1);
  });

  it("does not assign every team the same archetype", () => {
    const archetypes = new Set(VCT_TEAM_PROFILES.map((profile) => profile.archetype));
    expect(archetypes.size).toBeGreaterThan(1);
  });

  it("teams within the same region still differ from one another", () => {
    for (const region of ["americas", "emea", "pacific", "china"] as const) {
      const regionTeams = getVctTeamProfilesByRegion(region);
      const signatures = new Set(
        regionTeams.map((profile) => JSON.stringify(profile.dna.dimensions.map((d) => d.value))),
      );
      expect(signatures.size).toBe(regionTeams.length);
    }
  });

  it("has at least one team with a clearly distinguishable strongest vs. weakest map", () => {
    const gaps = VCT_TEAM_PROFILES.map((profile) => {
      const strongest = getStrongestVctMap(profile.teamId)!;
      const weakest = getWeakestVctMap(profile.teamId)!;
      return strongest.strength - weakest.strength;
    });
    expect(Math.max(...gaps)).toBeGreaterThan(10);
  });
});

describe("getVctTeamProfile", () => {
  it("finds a known team", () => {
    expect(getVctTeamProfile("paper-rex")?.teamId).toBe("paper-rex");
  });

  it("returns undefined for an unknown team", () => {
    expect(getVctTeamProfile("not-a-real-team" as VctTeamId)).toBeUndefined();
  });
});
