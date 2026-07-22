import { createHash } from "node:crypto";
import { FEATURE_RULES_VERSION, FEATURE_SCHEMA_VERSION } from "./versions";
import type { EloConfig } from "./versions";

/**
 * Feature dataset versioning — TASK-044 requirement 21. Mirrors
 * `curate/curatedVersion.ts`'s deterministic-hash approach: the same
 * source curated dataset, the same feature schema/rules, and the same
 * rating configuration always reproduce the same `featureDatasetVersion` —
 * never a random UUID, never dependent on `generatedAt`.
 */
export interface FeatureVersionInputs {
  readonly sourceDatasetVersion: string;
  readonly eloConfig: EloConfig;
  readonly rowContentHashes: readonly string[];
}

export interface FeatureVersion {
  readonly featureDatasetVersion: string;
  readonly featureSchemaVersion: string;
  readonly featureRulesVersion: string;
  readonly ratingConfigVersion: string;
  readonly sourceDatasetVersion: string;
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries.map(([key, val]) => [key, sortKeysDeep(val)]));
  }
  return value;
}

export function contentHashOf(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(sortKeysDeep(value))).digest("hex");
}

/** Hashes `value` after dropping `omitKeys` — used to version a row on its ML-relevant content only, so a purely cosmetic field never changes the resulting hash. */
export function contentHashOfOmitting<T extends object>(value: T, omitKeys: readonly string[]): string {
  const omitSet = new Set<string>(omitKeys);
  const filtered = Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => !omitSet.has(key)));
  return contentHashOf(filtered);
}

export function computeFeatureDatasetVersion(inputs: FeatureVersionInputs): FeatureVersion {
  const canonical = JSON.stringify({
    featureSchemaVersion: FEATURE_SCHEMA_VERSION,
    featureRulesVersion: FEATURE_RULES_VERSION,
    ratingConfigVersion: inputs.eloConfig.ratingVersion,
    initialRating: inputs.eloConfig.initialRating,
    kFactor: inputs.eloConfig.kFactor,
    sourceDatasetVersion: inputs.sourceDatasetVersion,
    rowContentHashes: [...inputs.rowContentHashes].sort(),
  });
  const hash = createHash("sha256").update(canonical).digest("hex").slice(0, 16);
  return {
    featureDatasetVersion: hash,
    featureSchemaVersion: FEATURE_SCHEMA_VERSION,
    featureRulesVersion: FEATURE_RULES_VERSION,
    ratingConfigVersion: inputs.eloConfig.ratingVersion,
    sourceDatasetVersion: inputs.sourceDatasetVersion,
  };
}
