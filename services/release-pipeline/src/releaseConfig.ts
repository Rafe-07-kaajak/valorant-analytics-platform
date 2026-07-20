import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * Env-driven configuration for the release-pipeline's own CLI
 * (`pnpm release:*`) — distinct from `environmentSchema.ts` (which
 * describes `apps/web`'s *production runtime* configuration). Every value
 * is read fresh from `process.env`, mirroring every other config module in
 * this repository (`services/vlr-ingestion/src/env.ts`,
 * `services/model-inference/src/config.ts`, `runtimePackage/config.ts`).
 */

export interface ReleasePipelineConfig {
  readonly repoRootDir: string;
  /** Where `release:bundle:build` stages a release bundle. Never a source directory. */
  readonly bundleOutputDir: string;
  /** Read-only source: `apps/web`'s own root directory. */
  readonly appSourceDir: string;
  /** Read-only source: an already-built TASK-048 runtime package. */
  readonly runtimePackageDir: string;
  /** Where promotion/release-state metadata is written — deliberately separate from `bundleOutputDir` so promoting a release never mutates its content-hashed files. */
  readonly releaseStateDir: string;
  readonly expectedRuntimePackageVersion: string | undefined;
  readonly requireCleanTree: boolean;
  readonly maxFileBytes: number;
}

function readOptionalString(name: string): string | undefined {
  const raw = process.env[name];
  const trimmed = raw?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
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

/** `services/release-pipeline/src/releaseConfig.ts` -> repo root is 3 levels up. Never a hardcoded developer-machine path. */
function defaultRepoRootDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..", "..");
}

export function loadReleasePipelineConfig(): ReleasePipelineConfig {
  const repoRootDir = readOptionalString("RELEASE_REPO_ROOT_DIR") ?? defaultRepoRootDir();
  return {
    repoRootDir,
    bundleOutputDir: readOptionalString("RELEASE_BUNDLE_OUTPUT_DIR") ?? resolve(repoRootDir, "services", "release-pipeline", ".local", "release-bundle"),
    appSourceDir: readOptionalString("RELEASE_APP_SOURCE_DIR") ?? resolve(repoRootDir, "apps", "web"),
    runtimePackageDir: readOptionalString("RELEASE_RUNTIME_PACKAGE_DIR") ?? resolve(repoRootDir, "services", "model-inference", ".local", "runtime-package"),
    releaseStateDir: readOptionalString("RELEASE_STATE_DIR") ?? resolve(repoRootDir, "services", "release-pipeline", ".local", "release-state"),
    expectedRuntimePackageVersion: readOptionalString("RELEASE_EXPECTED_RUNTIME_PACKAGE_VERSION"),
    requireCleanTree: readBool("RELEASE_REQUIRE_CLEAN_TREE", false),
    // Safe minimum/maximum: 10KB to 50MB per file, mirroring the runtime package's own ceiling.
    maxFileBytes: readClampedInt("RELEASE_MAX_FILE_BYTES", 50_000_000, 10_000, 50_000_000),
  };
}

/** Human-readable, safe-to-print summary — never a resolved directory's absolute path. */
export function describeReleasePipelineConfig(config: ReleasePipelineConfig): string {
  return [`require clean tree: ${config.requireCleanTree}`, `expected runtime package version: ${config.expectedRuntimePackageVersion ?? "(any)"}`, `max file bytes: ${config.maxFileBytes}`].join("\n");
}
