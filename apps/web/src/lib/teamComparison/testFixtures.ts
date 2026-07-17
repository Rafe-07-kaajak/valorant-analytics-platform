import type { VctTeamProfile } from "./types";

/**
 * Builds a controllable `VctTeamProfile`-shaped fixture for unit tests.
 * `VctTeamProfile` is imported type-only (see types.ts), so this file never
 * pulls in `@repo/prediction-engine` at runtime — it just shapes plain
 * objects matching that type for deterministic, isolated test input.
 */
export function buildProfileFixture(overrides: Partial<VctTeamProfile> = {}): VctTeamProfile {
  return {
    teamId: "paper-rex",
    region: "pacific",
    archetype: "balanced",
    overallRating: 70,
    dna: {
      teamId: "paper-rex",
      dimensions: [
        { key: "aggression", label: "Aggression", value: 70 },
        { key: "tempo", label: "Tempo", value: 65 },
        { key: "mapControl", label: "Map Control", value: 60 },
        { key: "utilityEfficiency", label: "Utility Efficiency", value: 68 },
        { key: "adaptability", label: "Adaptability", value: 62 },
        { key: "clutchAbility", label: "Clutch Ability", value: 66 },
      ],
    },
    attackStrength: 70,
    defenseStrength: 68,
    economyEfficiency: 68,
    clutchPerformance: 66,
    consistency: 62,
    mapControl: 60,
    roundDifferential: 1,
    recentFormIndex: 70,
    mapStrength: {
      ascent: 70,
      bind: 68,
      haven: 65,
      lotus: 60,
      pearl: 58,
      split: 62,
      sunset: 66,
      icebox: 64,
    },
    ...overrides,
  };
}
