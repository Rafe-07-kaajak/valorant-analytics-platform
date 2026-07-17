import {
  SIMULATION_DELTA_MAX,
  SIMULATION_DELTA_MIN,
  type DnaDimensionKey,
  type VctProfileAdjustment,
  type VctProfileScalarField,
} from "@repo/shared";
import { clampScore } from "./teamDna";
import type { VctTeamProfile } from "./vctTeamProfiles";

/**
 * TASK-038 isolated profile-mutation helpers. Every function here returns a
 * brand-new object — none ever mutates its input — so a cloned-and-adjusted
 * profile can never be confused with, or leak into, the frozen
 * `VCT_TEAM_PROFILES` registry the rest of the engine reads. There is no
 * module-level mutable state here, so concurrent callers (different
 * requests, different adjustment payloads) can never observe each other's
 * clones.
 */

/** Deep clone — a shallow `{ ...profile }` would still share the `dna.dimensions` array and `mapStrength` object with the frozen original. */
export function cloneVctTeamProfile(profile: VctTeamProfile): VctTeamProfile {
  return {
    ...profile,
    dna: {
      teamId: profile.dna.teamId,
      dimensions: profile.dna.dimensions.map((dimension) => ({ ...dimension })),
    },
    mapStrength: { ...profile.mapStrength },
  };
}

function clampDelta(value: number): number {
  return Math.min(SIMULATION_DELTA_MAX, Math.max(SIMULATION_DELTA_MIN, value));
}

/** Applies one bounded delta to a top-level scalar field, clamped to the valid 0-100 profile scale. */
export function applyScalarDelta(
  profile: VctTeamProfile,
  field: VctProfileScalarField,
  delta: number,
): VctTeamProfile {
  return { ...profile, [field]: clampScore(profile[field] + clampDelta(delta)) };
}

/** Applies one bounded delta to a single Team DNA dimension, clamped to the valid 0-100 profile scale. */
export function applyDnaDelta(
  profile: VctTeamProfile,
  dimensionKey: DnaDimensionKey,
  delta: number,
): VctTeamProfile {
  const dimensions = profile.dna.dimensions.map((dimension) =>
    dimension.key === dimensionKey
      ? { ...dimension, value: clampScore(dimension.value + clampDelta(delta)) }
      : dimension,
  );
  return { ...profile, dna: { ...profile.dna, dimensions } };
}

/** Applies one bounded delta to a single map's modeled strength. A map id absent from the profile is left untouched rather than silently created. */
export function applyMapStrengthDelta(profile: VctTeamProfile, mapId: string, delta: number): VctTeamProfile {
  if (!(mapId in profile.mapStrength)) return profile;
  return {
    ...profile,
    mapStrength: { ...profile.mapStrength, [mapId]: clampScore(profile.mapStrength[mapId]! + clampDelta(delta)) },
  };
}

/**
 * Applies a full `VctProfileAdjustment` to a baseline profile via
 * clone-then-adjust. The baseline `profile` argument (always a reference
 * into the frozen `VCT_TEAM_PROFILES` registry in production use) is never
 * mutated or returned — the result is always a fresh object.
 */
export function applyVctProfileAdjustment(
  profile: VctTeamProfile,
  adjustment: VctProfileAdjustment,
): VctTeamProfile {
  let next = cloneVctTeamProfile(profile);

  for (const [field, delta] of Object.entries(adjustment.scalar) as [VctProfileScalarField, number][]) {
    if (typeof delta === "number") next = applyScalarDelta(next, field, delta);
  }
  for (const [key, delta] of Object.entries(adjustment.dna) as [DnaDimensionKey, number][]) {
    if (typeof delta === "number") next = applyDnaDelta(next, key, delta);
  }
  for (const [mapId, delta] of Object.entries(adjustment.mapStrength)) {
    if (typeof delta === "number") next = applyMapStrengthDelta(next, mapId, delta);
  }

  return next;
}
