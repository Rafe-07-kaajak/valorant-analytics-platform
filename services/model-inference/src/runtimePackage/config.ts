import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * Typed configuration for the runtime-packaging CLI (`pnpm runtime:package:*`)
 * — TASK-048. Distinct from `../config.ts` (which configures the *inference
 * service's* artifact source): these values configure the packaging
 * pipeline's read-only source directories and its write-only staging output
 * directory. Every value is read fresh from `process.env` on every call,
 * mirroring the rest of this package's config modules.
 */

export interface RuntimePackageBuildConfig {
  /** Where `runtime:package:build` writes the staged package. Never a source directory. */
  readonly outputDir: string;
  /** Read-only source: the currently-selected model artifact's directory. */
  readonly sourceModelDir: string;
  /** Read-only source: the `vlr-data` root directory containing a `features/` subdirectory. */
  readonly sourceFeatureDataDir: string;
  /** Per-file size guard, both when reading source files and when a loader later reads a built package. */
  readonly maxFileBytes: number;
}

function readOptionalString(name: string): string | undefined {
  const raw = process.env[name];
  const trimmed = raw?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function readClampedInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/** Default: `services/model-inference/.local/runtime-package`, resolved relative to this module's own location — never a hardcoded developer-machine path. */
function defaultOutputDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..", ".local", "runtime-package");
}

/** Default: `services/vlr-ingestion/.local/vlr-data/models/selected-model` — same target `../config.ts`'s `MODEL_INFERENCE_ARTIFACT_DIR` default points at. */
function defaultSourceModelDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..", "..", "vlr-ingestion", ".local", "vlr-data", "models", "selected-model");
}

/** Default: `services/vlr-ingestion/.local/vlr-data` — same root `apps/web`'s `REAL_PREDICTION_FEATURE_DATA_DIR` default points at. */
function defaultSourceFeatureDataDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..", "..", "vlr-ingestion", ".local", "vlr-data");
}

export function loadRuntimePackageBuildConfig(): RuntimePackageBuildConfig {
  return {
    outputDir: readOptionalString("RUNTIME_PACKAGE_OUTPUT_DIR") ?? defaultOutputDir(),
    sourceModelDir: readOptionalString("RUNTIME_PACKAGE_SOURCE_MODEL_DIR") ?? defaultSourceModelDir(),
    sourceFeatureDataDir: readOptionalString("RUNTIME_PACKAGE_SOURCE_FEATURE_DATA_DIR") ?? defaultSourceFeatureDataDir(),
    // Safe minimum/maximum: 10KB to 50MB per file, mirroring `MODEL_INFERENCE_MAX_ARTIFACT_FILE_BYTES`'s ceiling.
    maxFileBytes: readClampedInt("RUNTIME_PACKAGE_MAX_FILE_BYTES", 50_000_000, 10_000, 50_000_000),
  };
}

/** Human-readable, safe-to-print summary — never the resolved directories' absolute paths. */
export function describeRuntimePackageBuildConfig(config: RuntimePackageBuildConfig): string {
  return [`max file bytes: ${config.maxFileBytes}`].join("\n");
}
