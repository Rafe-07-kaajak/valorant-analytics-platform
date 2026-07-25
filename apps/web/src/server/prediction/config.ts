import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Typed configuration for TASK-047's real-prediction backend integration.
 * Mirrors `services/model-inference/src/config.ts`: every value is read
 * fresh from `process.env` (never cached at module scope, so tests can
 * mutate `process.env` between assertions), and every default is
 * conservative — historical replay fails closed (structured "unavailable"),
 * never a silent crash, when the local generated dataset is absent.
 */

/** TASK-048: which data source the real-prediction backend reads from. `local-generated` is today's TASK-047 behavior (raw `services/vlr-ingestion/.local/vlr-data` output); `runtime-package` reads a staged, hash-verified `runtime-package/` directory instead. There is no silent fallback between the two — an invalid/unset value falls back to `local-generated` (the safe default for local dev), never a runtime auto-switch. */
export type RealPredictionSourceMode = "local-generated" | "runtime-package";

export interface RealPredictionConfig {
  /** Master kill switch for the historical-real-model routes. */
  readonly enabled: boolean;
  /** Root `vlr-data` directory (contains a `features/` subdirectory) — same convention as `VLR_DATA_DIR` in `services/vlr-ingestion/src/env.ts`. Only consulted when `sourceMode` is `"local-generated"`. */
  readonly featureDataDir: string;
  /** Page size used when a caller requests the catalog with no explicit `limit`. */
  readonly catalogLimit: number;
  /** TASK-057: hard upper bound on any single catalog response, regardless of a caller-requested `limit` — distinct from `catalogLimit` (the *default* page size) so the archive's own "Load more" control can request progressively larger pages up to the full dataset without an unconfigured deployment's default response growing. */
  readonly catalogMaxLimit: number;
  /** TASK-048: which data source to read from. */
  readonly sourceMode: RealPredictionSourceMode;
  /** TASK-048: only consulted when `sourceMode` is `"runtime-package"`. */
  readonly runtimePackageDir: string;
  /** TASK-048: when `true` and `sourceMode` is `"runtime-package"`, a missing/invalid package fails loud at first use instead of surfacing as a normal `runtime_package_missing` unavailable state. */
  readonly requireRuntimePackage: boolean;
  /** TASK-048: optional pinned `runtimePackageVersion`; a mismatch reports `runtime_package_version_mismatch`. */
  readonly expectedRuntimePackageVersion: string | undefined;
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
 * Default feature dataset directory: resolved relative to `process.cwd()`
 * (never a hardcoded developer-machine absolute path, and never a module's
 * own `import.meta.url` location) — same pattern as `@repo/model-inference`'s
 * `defaultArtifactDir()`.
 *
 * Deployment-fix task (round 2): a prior version of this function derived
 * its base directory from `dirname(fileURLToPath(import.meta.url))`. That
 * is unsound for a bundled Next.js server: Next's compiler statically
 * substitutes `import.meta.url` with the *build machine's* absolute source
 * path at build time (confirmed by inspecting the compiled `.next/server`
 * chunks), not a value that reflects where the code actually executes from.
 * Locally this "worked" only because the build and the run happened on the
 * same machine/filesystem. On Vercel, the build machine's absolute path
 * does not exist in the deployed runtime, so both the `.local` check and
 * the fallback below silently resolved to nonexistent paths — this is the
 * actual root cause of "the curated real match dataset is not available
 * locally" in production. `process.cwd()` is the documented, Vercel-stable
 * anchor for `outputFileTracingIncludes` (see Next.js's own docs example),
 * since Vercel sets a Next.js serverless function's working directory to
 * the project root (`apps/web`, this repo's Vercel Root Directory) at
 * runtime — a genuine dynamic value no bundler can statically inline.
 *
 * Prefers a developer's own freshly-generated
 * `services/vlr-ingestion/.local/vlr-data` (TASK-044's gitignored output —
 * always wins when present, so running the real ingestion pipeline locally
 * still takes priority) and falls back to `apps/web/server-data/vlr-data`
 * — a small, deterministic, git-committed snapshot living *inside* this
 * app (not across a monorepo package boundary) of exactly the files
 * `currentMatchupRepository.ts` and `historicalFeatureRepository.ts`'s
 * local-generated mode read. No env var is required for either
 * environment; `REAL_PREDICTION_FEATURE_DATA_DIR` still overrides both when set.
 */
function defaultFeatureDataDir(): string {
  const generated = resolve(process.cwd(), "..", "..", "services", "vlr-ingestion", ".local", "vlr-data");
  if (existsSync(generated)) return generated;
  return resolve(process.cwd(), "server-data", "vlr-data");
}

/** Default: `services/model-inference/.local/runtime-package`, resolved relative to `process.cwd()` — same staging directory `pnpm runtime:package:build` writes to by default, and the same `process.cwd()` rationale as `defaultFeatureDataDir()` above. */
function defaultRuntimePackageDir(): string {
  return resolve(process.cwd(), "..", "..", "services", "model-inference", ".local", "runtime-package");
}

function readSourceMode(): RealPredictionSourceMode {
  const raw = readOptionalString("REAL_PREDICTION_SOURCE_MODE");
  // Invalid/unset values fall back to the safe local-dev default rather than
  // throwing — this mirrors every other config module's "invalid falls back
  // to default" convention, and there is no silent *runtime* fallback
  // between modes once a mode is selected (see historicalFeatureRepository.ts).
  return raw === "runtime-package" ? "runtime-package" : "local-generated";
}

export function loadRealPredictionConfig(): RealPredictionConfig {
  return {
    enabled: readBool("REAL_PREDICTION_ENABLED", true),
    featureDataDir: readOptionalString("REAL_PREDICTION_FEATURE_DATA_DIR") ?? defaultFeatureDataDir(),
    // Default page size for a caller that doesn't request an explicit `limit`.
    catalogLimit: readClampedInt("REAL_PREDICTION_CATALOG_LIMIT", 50, 1, 1000),
    // TASK-057: separate hard ceiling — the full dataset is 432 rows today,
    // so 500 lets the archive's "Load more" control reach every row across a
    // handful of clicks, while a caller-requested `limit` is still clamped
    // here, so this never becomes an unbounded single response.
    catalogMaxLimit: readClampedInt("REAL_PREDICTION_CATALOG_MAX_LIMIT", 500, 1, 1000),
    sourceMode: readSourceMode(),
    runtimePackageDir: readOptionalString("REAL_PREDICTION_RUNTIME_PACKAGE_DIR") ?? defaultRuntimePackageDir(),
    requireRuntimePackage: readBool("REAL_PREDICTION_REQUIRE_RUNTIME_PACKAGE", false),
    expectedRuntimePackageVersion: readOptionalString("REAL_PREDICTION_EXPECTED_RUNTIME_PACKAGE_VERSION"),
  };
}

/** Human-readable, safe-to-print summary — never the resolved directory's absolute path. */
export function describeRealPredictionConfig(config: RealPredictionConfig): string {
  return [`enabled: ${config.enabled}`, `catalog limit: ${config.catalogLimit}`, `catalog max limit: ${config.catalogMaxLimit}`, `source mode: ${config.sourceMode}`, `require runtime package: ${config.requireRuntimePackage}`].join("\n");
}
