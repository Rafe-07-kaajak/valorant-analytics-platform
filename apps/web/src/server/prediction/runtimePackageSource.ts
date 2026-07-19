import { loadRuntimePackage, isRuntimePackageError, type LoadedRuntimePackage, type RuntimePackageErrorCode } from "@repo/model-inference";
import type { PredictionErrorCode } from "@repo/shared";
import { PredictionApiError } from "./errors";
import { loadRealPredictionConfig } from "./config";

/**
 * Server-only, memoized wrapper around `@repo/model-inference`'s
 * `loadRuntimePackage()` — TASK-048. Mirrors
 * `historicalFeatureRepository.ts`'s existing cache pattern exactly: loaded
 * once per process, reset only by an explicit test-only function, no public
 * route can trigger a reload. Translates `RuntimePackageError` into this
 * task's own `PredictionApiError` taxonomy (`runtime_package_*` codes) —
 * kept local to this module rather than folded into `errors.ts`'s
 * `mapInferenceError`, since the two translate different source error
 * spaces (model inference vs. package integrity).
 */

let cache: Promise<LoadedRuntimePackage> | null = null;

/** `RuntimePackageErrorCode` matches `PredictionErrorCode`'s `runtime_package_*` entries 1:1, except for the internal-only `runtime_package_build_failed` catch-all, which has no browser-safe equivalent and is reported as a generic internal error instead. */
function mapRuntimePackageErrorCode(code: RuntimePackageErrorCode): PredictionErrorCode {
  switch (code) {
    case "runtime_package_missing":
    case "runtime_package_manifest_invalid":
    case "runtime_package_hash_mismatch":
    case "runtime_package_version_mismatch":
    case "runtime_package_model_mismatch":
    case "runtime_package_feature_mismatch":
    case "runtime_package_row_count_mismatch":
    case "runtime_package_unsafe_path":
    case "runtime_package_unsupported_target":
      return code;
    default:
      return "internal_error";
  }
}

async function loadOnce(): Promise<LoadedRuntimePackage> {
  const config = loadRealPredictionConfig();
  try {
    return await loadRuntimePackage(config.runtimePackageDir, {
      maxFileBytes: 50_000_000,
      ...(config.expectedRuntimePackageVersion ? { expectedVersion: config.expectedRuntimePackageVersion } : {}),
    });
  } catch (error) {
    if (isRuntimePackageError(error)) {
      throw new PredictionApiError(mapRuntimePackageErrorCode(error.code), error.message);
    }
    throw new PredictionApiError("internal_error", "An unexpected internal error occurred while loading the runtime package.");
  }
}

/** Triggers (once) and awaits the runtime package's load; safe to call from every request. Never re-reads disk after the first successful load. */
export async function getRuntimePackage(): Promise<LoadedRuntimePackage> {
  if (!cache) {
    cache = loadOnce().catch((error) => {
      // Reset so a later request can retry the load (e.g. after an operator
      // fixes/mounts the package), rather than being permanently stuck on
      // one rejected promise for the lifetime of the process.
      cache = null;
      throw error;
    });
  }
  return cache;
}

/** Test-only cache reset — mirrors `resetHistoricalRepositoryCacheForTesting()`. No public route triggers this. */
export function resetRuntimePackageCacheForTesting(): void {
  cache = null;
}
