import {
  SIMULATION_DELTA_MAX,
  SIMULATION_DELTA_MIN,
  VCT_PROFILE_SCALAR_FIELDS,
  type SimulationRequest,
} from "@repo/shared";
import { maps } from "./data/maps";
import { DNA_DIMENSIONS } from "./lib/teamDna";
import { validateVctScenario } from "./validateVctScenario";

const DNA_KEYS = new Set<string>(DNA_DIMENSIONS.map((dimension) => dimension.key));
const SCALAR_KEYS = new Set<string>(VCT_PROFILE_SCALAR_FIELDS);
const ADJUSTMENT_TOP_KEYS = new Set(["scalar", "dna", "mapStrength"]);
/** Rejected outright regardless of allowlist membership — defends against prototype-pollution payloads. */
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateDeltaMap(value: unknown, allowedKeys: Set<string>, label: string): string | null {
  if (!isPlainObject(value)) return `${label} must be an object.`;

  const keys = Object.keys(value);
  if (keys.length > allowedKeys.size) return `${label} has more entries than there are valid fields.`;

  for (const key of keys) {
    if (FORBIDDEN_KEYS.has(key)) return `${label} contains a disallowed key.`;
    if (!allowedKeys.has(key)) return `${label} contains an unsupported field: "${key}".`;

    const delta = value[key];
    if (typeof delta !== "number" || !Number.isFinite(delta)) {
      return `${label}.${key} must be a finite number.`;
    }
    if (delta < SIMULATION_DELTA_MIN || delta > SIMULATION_DELTA_MAX) {
      return `${label}.${key} must be between ${SIMULATION_DELTA_MIN} and ${SIMULATION_DELTA_MAX}.`;
    }
  }

  return null;
}

function validateAdjustment(value: unknown, label: string, allowedMapIds: Set<string>): string | null {
  if (!isPlainObject(value)) return `${label} must be an object.`;

  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEYS.has(key)) return `${label} contains a disallowed key.`;
    if (!ADJUSTMENT_TOP_KEYS.has(key)) return `${label} contains an unsupported field: "${key}".`;
  }

  const scalarError = validateDeltaMap(value.scalar ?? {}, SCALAR_KEYS, `${label}.scalar`);
  if (scalarError) return scalarError;

  const dnaError = validateDeltaMap(value.dna ?? {}, DNA_KEYS, `${label}.dna`);
  if (dnaError) return dnaError;

  const mapError = validateDeltaMap(value.mapStrength ?? {}, allowedMapIds, `${label}.mapStrength`);
  if (mapError) return mapError;

  return null;
}

/**
 * TASK-038. Runs `validateVctScenario` first (identical scenario rules to
 * the production prediction path — same team/map/series checks), then
 * validates both teams' hypothetical adjustment payloads: allowlisted
 * fields only, finite numbers within `[SIMULATION_DELTA_MIN,
 * SIMULATION_DELTA_MAX]`, no prototype-pollution keys, no unsupported
 * structure, and map deltas restricted to maps already in the submitted
 * scenario. The server never trusts client-side clamping — this runs
 * regardless of what the client already validated/clamped.
 */
export function validateSimulationRequest(request: SimulationRequest): string | null {
  const scenarioError = validateVctScenario(request);
  if (scenarioError) return scenarioError;

  const allowedMapIds = new Set(request.scenario.mapIds.filter((mapId) => maps.some((map) => map.id === mapId)));

  const teamAError = validateAdjustment(request.teamAAdjustment, "teamAAdjustment", allowedMapIds);
  if (teamAError) return teamAError;

  const teamBError = validateAdjustment(request.teamBAdjustment, "teamBAdjustment", allowedMapIds);
  if (teamBError) return teamBError;

  return null;
}
