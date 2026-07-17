import type { DnaDimensionKey } from "./team-dna";
import type { PredictionResult, Scenario } from "./prediction";

/**
 * TASK-038 What-if Simulator contract — additive to `PredictionRequest`/
 * `PredictionResult`. The default prediction API and its types are
 * untouched; this is a separate, explicitly hypothetical request/response
 * pair for a scenario-analysis tool, not a claim about real performance.
 */

/**
 * Profile-level scalar fields that may be hypothetically adjusted.
 * Deliberately excludes `overallRating`, `roundDifferential`, `mapControl`
 * (identical to the `dna.mapControl` dimension already adjustable below),
 * and every identity/metadata field (`teamId`, `region`, `archetype`) — see
 * `docs/26-what-if-simulator.md` for the full rationale.
 */
export type VctProfileScalarField =
  | "attackStrength"
  | "defenseStrength"
  | "economyEfficiency"
  | "clutchPerformance"
  | "consistency"
  | "recentFormIndex";

export const VCT_PROFILE_SCALAR_FIELDS: readonly VctProfileScalarField[] = [
  "attackStrength",
  "defenseStrength",
  "economyEfficiency",
  "clutchPerformance",
  "consistency",
  "recentFormIndex",
];

/** Bounds every hypothetical delta (a Team DNA dimension, a scalar field, or a per-map strength) must fall within. */
export const SIMULATION_DELTA_MIN = -15;
export const SIMULATION_DELTA_MAX = 15;
export const SIMULATION_DELTA_STEP = 1;

/**
 * A hypothetical adjustment to one team's modeled profile. Every field is
 * optional — an absent key means "no hypothetical change for that field",
 * never an implicit zero-as-a-value. Deltas are relative to the baseline
 * profile, not absolute replacements.
 */
export interface VctProfileAdjustment {
  scalar: Partial<Record<VctProfileScalarField, number>>;
  dna: Partial<Record<DnaDimensionKey, number>>;
  /** Keyed by map id; only maps already selected in the scenario are meaningful. */
  mapStrength: Record<string, number>;
}

export function createEmptyVctProfileAdjustment(): VctProfileAdjustment {
  return { scalar: {}, dna: {}, mapStrength: {} };
}

export interface SimulationRequest {
  requestId: string;
  clientVersion: string;
  timestamp: string;
  scenario: Scenario;
  teamAAdjustment: VctProfileAdjustment;
  teamBAdjustment: VctProfileAdjustment;
}

export interface SimulationResult {
  simulationId: string;
  requestId: string;
  result: PredictionResult;
  teamAAdjustment: VctProfileAdjustment;
  teamBAdjustment: VctProfileAdjustment;
  generatedAt: string;
}

/**
 * The read-only baseline numbers the Controls tab needs to display an
 * honest "baseline value" next to every slider, before any simulation has
 * run. Deliberately excludes `teamId`, `region`, `archetype`,
 * `overallRating`, `roundDifferential`, and any map outside the requested
 * set — this is a narrow projection of `VctTeamProfile`, not the profile
 * itself.
 */
export interface VctProfileBaseline {
  attackStrength: number;
  defenseStrength: number;
  economyEfficiency: number;
  clutchPerformance: number;
  consistency: number;
  recentFormIndex: number;
  aggression: number;
  tempo: number;
  mapControl: number;
  utilityEfficiency: number;
  adaptability: number;
  clutchAbility: number;
  /** Keyed by map id, restricted to whatever set of maps was requested. */
  mapStrength: Record<string, number>;
}

export interface VctProfileBaselineRequest {
  teamAId: string;
  teamBId: string;
  mapIds: string[];
}

export interface VctProfileBaselineResponse {
  teamA: VctProfileBaseline;
  teamB: VctProfileBaseline;
}
