import type { DnaDimensionKey, TeamDna } from "@repo/shared";
import { maps } from "../data/maps";
import { VCT_TEAM_IDENTITIES, type VctRegionId, type VctTeamId } from "../data/vctTeams";
import { seededRatio } from "./seededRatio";
import { clampScore, DNA_DIMENSIONS } from "./teamDna";

/**
 * Synthetic 32-team profile layer (TASK-031).
 *
 * The existing prediction pipeline (`data/matchHistory.ts` →
 * `validateMatchHistory` → `normalizeMatchHistory` → `teamDna`) derives Team
 * DNA from a simulated *raw match corpus*, and `validateMatchHistory` hard-
 * codes its known-team/known-map allowlist from the original 8-team roster.
 * Extending that corpus to 32 teams would mean editing code the live
 * Prediction Studio path depends on today, which TASK-031 explicitly must
 * not touch.
 *
 * This module instead derives each team's profile directly, as a pure
 * function of its stable id (plus a small set of named archetype/region
 * inputs) — no raw match records, no `Math.random()`, nothing mutable.
 * Every value is either a small "core" trait or computed from those core
 * traits; nothing is independently hand-authored per team, so there is
 * nothing that can drift out of consistency.
 *
 * Every value here is modeled/simulated demonstration data — see
 * `VCT_PROFILE_DISCLOSURE`. Nothing in this module is presented as real
 * tournament or Riot-provided statistics.
 */

export type VctArchetype =
  | "aggressive-tempo"
  | "structured-control"
  | "defensive-discipline"
  | "clutch-oriented"
  | "map-specialist"
  | "balanced"
  | "volatile-high-ceiling"
  | "economy-efficient";

export interface VctTeamProfile {
  teamId: VctTeamId;
  region: VctRegionId;
  /** Internal, neutral generation label — not user-facing flavor text. */
  archetype: VctArchetype;
  /** General strength baseline (0-100), independent of playstyle. */
  overallRating: number;
  /** Reuses @repo/shared's TeamDna shape so this is compatible with the existing prediction math as-is. */
  dna: TeamDna;
  attackStrength: number;
  defenseStrength: number;
  /** Alias of `dna`'s `utilityEfficiency` dimension. */
  economyEfficiency: number;
  /** Alias of `dna`'s `clutchAbility` dimension. */
  clutchPerformance: number;
  /** Alias of `dna`'s `adaptability` dimension. */
  consistency: number;
  /** Alias of `dna`'s `mapControl` dimension. */
  mapControl: number;
  /** Modeled average round differential per map, bounded to [-8, 8]. */
  roundDifferential: number;
  /** Modeled current-form trend (0-100) — not a literal recent-match tally. */
  recentFormIndex: number;
  /** One entry (0-100) per map in `data/maps.ts` — every supported map is covered. */
  mapStrength: Readonly<Record<string, number>>;
}

export const VCT_PROFILE_DISCLOSURE =
  "Predictions use simulated team profiles for demonstration purposes. Values are modeled estimates, not real statistics from Riot Games or any tournament.";

const ARCHETYPES: readonly VctArchetype[] = [
  "aggressive-tempo",
  "structured-control",
  "defensive-discipline",
  "clutch-oriented",
  "map-specialist",
  "balanced",
  "volatile-high-ceiling",
  "economy-efficient",
];

/** Small, bounded thematic offsets applied on top of each team's own random baseline. */
const ARCHETYPE_BIAS: Record<VctArchetype, Partial<Record<DnaDimensionKey, number>>> = {
  "aggressive-tempo": { aggression: 16, tempo: 14, mapControl: -6, adaptability: -4 },
  "structured-control": { mapControl: 16, utilityEfficiency: 10, aggression: -8 },
  "defensive-discipline": { utilityEfficiency: 14, mapControl: 10, tempo: -10, aggression: -6 },
  "clutch-oriented": { clutchAbility: 18, tempo: 6, adaptability: -6 },
  "map-specialist": { adaptability: -16, mapControl: 8 },
  balanced: {},
  "volatile-high-ceiling": { aggression: 12, clutchAbility: 10, adaptability: -14, utilityEfficiency: -6 },
  "economy-efficient": { utilityEfficiency: 16, mapControl: 6, aggression: -8 },
};

/** How strongly the "balanced" archetype pulls a team's raw random baseline toward the 50 midpoint. */
const BALANCED_PULL = 0.35;
/** Max magnitude of the region-level nudge — team-level identity must dominate (requirement 6). */
const REGION_BIAS_MAX = 5;
const MAX_ROUND_DIFFERENTIAL = 8;
const FORM_VOLATILITY = 10;
const MAP_STRENGTH_SPREAD_MAX = 30;

function pickArchetype(teamId: VctTeamId): VctArchetype {
  const index = Math.floor(seededRatio(`${teamId}:archetype`) * ARCHETYPES.length);
  return ARCHETYPES[Math.min(index, ARCHETYPES.length - 1)]!;
}

/**
 * Small deterministic per-region nudge. Derived from a hash of the region
 * id rather than hand-authored per-region assumptions, so no real-world
 * regional stereotype is encoded — it is bounded noise, not a claim.
 */
function regionBias(region: VctRegionId, label: string): number {
  return (seededRatio(`region:${region}:${label}`) - 0.5) * 2 * REGION_BIAS_MAX;
}

function computeCoreDimension(
  teamId: VctTeamId,
  region: VctRegionId,
  archetype: VctArchetype,
  dimension: DnaDimensionKey,
): number {
  const base = seededRatio(`${teamId}:${dimension}`) * 100;
  const centered = archetype === "balanced" ? base + (50 - base) * BALANCED_PULL : base;
  const archetypeAdjustment = ARCHETYPE_BIAS[archetype][dimension] ?? 0;
  return clampScore(centered + archetypeAdjustment + regionBias(region, dimension));
}

function computeOverallRating(teamId: VctTeamId, region: VctRegionId): number {
  const base = seededRatio(`${teamId}:overallRating`) * 100;
  return clampScore(base + regionBias(region, "overallRating"));
}

function computeAttackStrength(aggression: number, tempo: number): number {
  return clampScore(aggression * 0.6 + tempo * 0.4);
}

function computeDefenseStrength(mapControl: number, utilityEfficiency: number): number {
  return clampScore(mapControl * 0.6 + utilityEfficiency * 0.4);
}

/** Sign follows overall strength; magnitude scales with tempo, so a team's own dimensions stay internally consistent. */
function computeRoundDifferential(overallRating: number, tempo: number): number {
  const sign = overallRating >= 50 ? 1 : -1;
  const strengthFactor = Math.abs(overallRating - 50) / 50;
  const tempoFactor = 0.5 + (tempo / 100) * 0.5;
  return Math.round(sign * strengthFactor * tempoFactor * MAX_ROUND_DIFFERENTIAL * 100) / 100;
}

function computeRecentFormIndex(teamId: VctTeamId, overallRating: number): number {
  const delta = (seededRatio(`${teamId}:recentForm`) - 0.5) * 2 * FORM_VOLATILITY;
  return clampScore(overallRating + delta);
}

/**
 * Map strength is centered on the team's overall rating with a per-map
 * swing. `adaptability` controls the swing's amplitude: a highly adaptable
 * team's map strengths stay flat (map-independent), a low-adaptability
 * "map-specialist" team shows a clearly distinguishable strongest/weakest
 * map, matching the existing Adaptability feature's own definition.
 */
function computeMapStrength(teamId: VctTeamId, mapId: string, overallRating: number, adaptability: number): number {
  const varianceScale = 1 - adaptability / 100;
  const swing = (seededRatio(`${teamId}:map:${mapId}`) - 0.5) * 2 * MAP_STRENGTH_SPREAD_MAX * varianceScale;
  return clampScore(overallRating + swing);
}

function buildTeamProfile(teamId: VctTeamId, region: VctRegionId): VctTeamProfile {
  const archetype = pickArchetype(teamId);

  const coreDimensions = Object.fromEntries(
    DNA_DIMENSIONS.map(({ key }) => [key, computeCoreDimension(teamId, region, archetype, key)]),
  ) as Record<DnaDimensionKey, number>;

  const overallRating = computeOverallRating(teamId, region);

  const dna: TeamDna = {
    teamId,
    dimensions: DNA_DIMENSIONS.map(({ key, label }) => ({ key, label, value: coreDimensions[key] })),
  };

  const mapStrength: Record<string, number> = {};
  for (const map of maps) {
    mapStrength[map.id] = computeMapStrength(teamId, map.id, overallRating, coreDimensions.adaptability);
  }

  return Object.freeze({
    teamId,
    region,
    archetype,
    overallRating,
    dna,
    attackStrength: computeAttackStrength(coreDimensions.aggression, coreDimensions.tempo),
    defenseStrength: computeDefenseStrength(coreDimensions.mapControl, coreDimensions.utilityEfficiency),
    economyEfficiency: coreDimensions.utilityEfficiency,
    clutchPerformance: coreDimensions.clutchAbility,
    consistency: coreDimensions.adaptability,
    mapControl: coreDimensions.mapControl,
    roundDifferential: computeRoundDifferential(overallRating, coreDimensions.tempo),
    recentFormIndex: computeRecentFormIndex(teamId, overallRating),
    mapStrength: Object.freeze(mapStrength),
  });
}

/**
 * Generates the full 32-team profile set from scratch. Exposed alongside
 * the precomputed `VCT_TEAM_PROFILES` constant so determinism can be
 * verified directly: calling it twice must produce identical output.
 */
export function generateVctTeamProfiles(): VctTeamProfile[] {
  return VCT_TEAM_IDENTITIES.map((identity) => buildTeamProfile(identity.id, identity.region));
}

export const VCT_TEAM_PROFILES: readonly VctTeamProfile[] = Object.freeze(generateVctTeamProfiles());

export function getVctTeamProfile(teamId: VctTeamId): VctTeamProfile | undefined {
  return VCT_TEAM_PROFILES.find((profile) => profile.teamId === teamId);
}

export function getVctTeamProfilesByRegion(region: VctRegionId): readonly VctTeamProfile[] {
  return VCT_TEAM_PROFILES.filter((profile) => profile.region === region);
}

export function getVctMapStrength(teamId: VctTeamId, mapId: string): number | undefined {
  return getVctTeamProfile(teamId)?.mapStrength[mapId];
}

export interface VctMapStrengthEntry {
  mapId: string;
  strength: number;
}

function extremeMap(
  teamId: VctTeamId,
  comparator: (candidate: number, current: number) => boolean,
): VctMapStrengthEntry | undefined {
  const profile = getVctTeamProfile(teamId);
  if (!profile) return undefined;

  let best: VctMapStrengthEntry | undefined;
  for (const [mapId, strength] of Object.entries(profile.mapStrength)) {
    if (!best || comparator(strength, best.strength)) best = { mapId, strength };
  }
  return best;
}

export function getStrongestVctMap(teamId: VctTeamId): VctMapStrengthEntry | undefined {
  return extremeMap(teamId, (candidate, current) => candidate > current);
}

export function getWeakestVctMap(teamId: VctTeamId): VctMapStrengthEntry | undefined {
  return extremeMap(teamId, (candidate, current) => candidate < current);
}
