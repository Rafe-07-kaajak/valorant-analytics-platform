import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * Typed configuration for TASK-047's real-prediction backend integration.
 * Mirrors `services/model-inference/src/config.ts`: every value is read
 * fresh from `process.env` (never cached at module scope, so tests can
 * mutate `process.env` between assertions), and every default is
 * conservative — historical replay fails closed (structured "unavailable"),
 * never a silent crash, when the local generated dataset is absent.
 */

export interface RealPredictionConfig {
  /** Master kill switch for the historical-real-model routes. */
  readonly enabled: boolean;
  /** Root `vlr-data` directory (contains a `features/` subdirectory) — same convention as `VLR_DATA_DIR` in `services/vlr-ingestion/src/env.ts`. */
  readonly featureDataDir: string;
  /** Upper bound on any single catalog response, regardless of a caller-requested `limit`. */
  readonly catalogLimit: number;
}

function readBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw.trim().toLowerCase() === "true";
}

function readClampedInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function readOptionalString(name: string): string | undefined {
  const raw = process.env[name];
  const trimmed = raw?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Default feature dataset directory: resolved relative to this module's own
 * location on disk (never a hardcoded developer-machine absolute path) —
 * same pattern as `@repo/model-inference`'s `defaultArtifactDir()`. Points
 * at TASK-044's own output location (`services/vlr-ingestion/.local/vlr-data`)
 * without requiring any configuration for a local checkout that has already
 * run the ingestion/feature pipeline.
 */
function defaultFeatureDataDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..", "..", "..", "..", "services", "vlr-ingestion", ".local", "vlr-data");
}

export function loadRealPredictionConfig(): RealPredictionConfig {
  return {
    enabled: readBool("REAL_PREDICTION_ENABLED", true),
    featureDataDir: readOptionalString("REAL_PREDICTION_FEATURE_DATA_DIR") ?? defaultFeatureDataDir(),
    // Safe minimum/maximum: 1 to 200 rows per response — the full dataset is
    // 432 rows today, so this bounds a single catalog response well under
    // "the full feature dataset sent to client" (TASK-047 requirement 6).
    catalogLimit: readClampedInt("REAL_PREDICTION_CATALOG_LIMIT", 50, 1, 200),
  };
}

/** Human-readable, safe-to-print summary — never the resolved directory's absolute path. */
export function describeRealPredictionConfig(config: RealPredictionConfig): string {
  return [`enabled: ${config.enabled}`, `catalog limit: ${config.catalogLimit}`].join("\n");
}
