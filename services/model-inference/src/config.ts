import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Typed configuration for the model inference service — TASK-046
 * requirement 5. Every value is read from `process.env` on demand (never
 * cached at module scope, so tests can mutate `process.env` between
 * assertions — mirrors `services/vlr-ingestion/src/env.ts`). Defaults are
 * conservative: network is never enabled by this package (it never imports
 * anything network-capable), reload is off by default, and fallback is
 * disabled by default so a missing/broken artifact fails loudly instead of
 * silently returning a synthetic guess.
 */

export type FallbackPolicy = "disabled" | "constant";
export type LoggingMode = "safe" | "debug";

export interface ModelInferenceConfig {
  /** Local filesystem directory containing the artifact's files directly (not the `models/` parent). */
  readonly artifactDir: string;
  readonly expectedModelVersion: string | undefined;
  readonly expectedFeatureSchemaVersion: string | undefined;
  readonly loadOnStart: boolean;
  readonly requireModelOnStart: boolean;
  readonly strictHashValidation: boolean;
  readonly probabilityClipEpsilon: number;
  readonly maxRequestBytes: number;
  readonly reloadEnabled: boolean;
  readonly reloadIntervalMs: number | undefined;
  readonly fallbackPolicy: FallbackPolicy;
  readonly fallbackConstantProbability: number;
  readonly inferenceTimeoutMs: number;
  readonly loggingMode: LoggingMode;
  readonly maxArtifactFileBytes: number;
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

function readClampedFloat(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function readOptionalString(name: string): string | undefined {
  const raw = process.env[name];
  const trimmed = raw?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Default artifact directory: resolved relative to `process.cwd()` (never
 * this package's own `import.meta.url` location, and never a hardcoded
 * developer-machine absolute path), so it works out of the box for anyone
 * who has run `pnpm ingest:vlr:model:train` and points at TASK-045's own
 * output location without any configuration.
 *
 * Deployment-fix task (round 2): a prior version derived its base directory
 * from `dirname(fileURLToPath(import.meta.url))`. Next.js's compiler
 * statically substitutes `import.meta.url` with the *build machine's*
 * absolute source path at build time (confirmed by inspecting the compiled
 * `.next/server` chunks in the consuming `apps/web` app, where this
 * package's code ends up bundled) — not a value reflecting where the code
 * actually executes from. That baked-in path only "worked" locally because
 * build and run shared a filesystem; on Vercel the build machine's absolute
 * path does not exist at runtime, so this resolved to nothing, producing
 * the reported "Model failed" / historical dataset unavailable errors in
 * production. `process.cwd()` is a genuine runtime value (Vercel sets a
 * Next.js serverless function's working directory to the project root —
 * `apps/web`, this repo's Vercel Root Directory) that no bundler can
 * statically inline, and is Next's own documented anchor for use alongside
 * `outputFileTracingIncludes`. Both `services/model-inference` (this
 * package's own unit tests) and `apps/web` (where this code actually runs
 * in production, bundled into the Next.js server) sit exactly two
 * directories below the monorepo root, so `resolve(process.cwd(), "..", "..")`
 * reaches the same monorepo root in both contexts.
 *
 * Prefers the gitignored, freshly-trained
 * `services/vlr-ingestion/.local/vlr-data/models/selected-model` when
 * present (a local checkout that has run the real training pipeline always
 * wins), falling back to `apps/web/server-data/vlr-data/models/selected-model`
 * — a small, deterministic, git-committed copy of only the 5 files
 * `LocalFilesystemArtifactSource`'s `INFERENCE_CRITICAL_FILENAMES` actually
 * reads, committed *inside* the app that actually serves it (not across a
 * monorepo package boundary), so a serverless deployment with no persisted
 * `.local` directory still has a real model to load. See docs/36's "Vercel
 * deployment" section.
 */
function defaultArtifactDir(): string {
  const monorepoRoot = resolve(process.cwd(), "..", "..");
  const generated = resolve(monorepoRoot, "services", "vlr-ingestion", ".local", "vlr-data", "models", "selected-model");
  if (existsSync(generated)) return generated;
  return resolve(monorepoRoot, "apps", "web", "server-data", "vlr-data", "models", "selected-model");
}

export function loadModelInferenceConfig(): ModelInferenceConfig {
  const fallbackPolicyRaw = readOptionalString("MODEL_INFERENCE_FALLBACK_POLICY");
  const fallbackPolicy: FallbackPolicy = fallbackPolicyRaw === "constant" ? "constant" : "disabled";

  const loggingModeRaw = readOptionalString("MODEL_INFERENCE_LOG_MODE");
  const loggingMode: LoggingMode = loggingModeRaw === "debug" ? "debug" : "safe";

  const reloadEnabled = readBool("MODEL_INFERENCE_RELOAD_ENABLED", false);
  const reloadIntervalRaw = process.env.MODEL_INFERENCE_RELOAD_INTERVAL_MS;
  const reloadIntervalMs = reloadEnabled && reloadIntervalRaw !== undefined ? readClampedInt("MODEL_INFERENCE_RELOAD_INTERVAL_MS", 300_000, 60_000, 86_400_000) : undefined;

  return {
    artifactDir: readOptionalString("MODEL_INFERENCE_ARTIFACT_DIR") ?? defaultArtifactDir(),
    expectedModelVersion: readOptionalString("MODEL_INFERENCE_EXPECTED_MODEL_VERSION"),
    expectedFeatureSchemaVersion: readOptionalString("MODEL_INFERENCE_EXPECTED_FEATURE_SCHEMA_VERSION"),
    loadOnStart: readBool("MODEL_INFERENCE_LOAD_ON_START", true),
    requireModelOnStart: readBool("MODEL_INFERENCE_REQUIRE_MODEL_ON_START", false),
    strictHashValidation: readBool("MODEL_INFERENCE_STRICT_HASH_VALIDATION", true),
    // Safe range: never negative, never large enough to distort a
    // probability response contract.
    probabilityClipEpsilon: readClampedFloat("MODEL_INFERENCE_PROBABILITY_CLIP_EPSILON", 1e-15, 0, 1e-6),
    // Safe minimum/maximum: 1KB to 1MB — a pre-match feature row is a few
    // hundred flat scalar fields, far under this ceiling.
    maxRequestBytes: readClampedInt("MODEL_INFERENCE_MAX_REQUEST_BYTES", 262_144, 1_024, 1_048_576),
    reloadEnabled,
    reloadIntervalMs,
    fallbackPolicy,
    // Only meaningful when fallbackPolicy === "constant"; clamped to a valid probability.
    fallbackConstantProbability: readClampedFloat("MODEL_INFERENCE_FALLBACK_CONSTANT_PROBABILITY", 0.5, 0, 1),
    // Safe minimum/maximum: 100ms to 30s — inference here is pure in-memory
    // arithmetic over a single artifact, so this bound exists to catch a
    // hang, not to accommodate genuinely slow computation.
    inferenceTimeoutMs: readClampedInt("MODEL_INFERENCE_TIMEOUT_MS", 5_000, 100, 30_000),
    loggingMode,
    // Safe minimum/maximum: 10KB to 50MB per artifact file.
    maxArtifactFileBytes: readClampedInt("MODEL_INFERENCE_MAX_ARTIFACT_FILE_BYTES", 10_000_000, 10_000, 50_000_000),
  };
}

/** Human-readable, safe-to-print summary — mirrors `describeConfig` in `vlr-ingestion/src/env.ts`. Never prints the resolved artifact directory's absolute path (see `describeArtifactDirIdentity` in `artifactSource.ts` for a safe identity string). */
export function describeModelInferenceConfig(config: ModelInferenceConfig): string {
  return [
    `load on start: ${config.loadOnStart}`,
    `require model on start: ${config.requireModelOnStart}`,
    `strict hash validation: ${config.strictHashValidation}`,
    `reload enabled: ${config.reloadEnabled}${config.reloadEnabled && config.reloadIntervalMs ? ` (interval ${config.reloadIntervalMs}ms)` : ""}`,
    `fallback policy: ${config.fallbackPolicy}`,
    `inference timeout: ${config.inferenceTimeoutMs}ms`,
    `max request bytes: ${config.maxRequestBytes}`,
    `logging mode: ${config.loggingMode}`,
    `expected model version: ${config.expectedModelVersion ?? "(any)"}`,
    `expected feature schema version: ${config.expectedFeatureSchemaVersion ?? "(any)"}`,
  ].join("\n");
}
