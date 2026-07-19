import { PredictionService, loadModelInferenceConfig, LocalFilesystemArtifactSource, type RegistrySnapshot } from "@repo/model-inference";
import { loadRealPredictionConfig } from "./config";
import { getRuntimePackage } from "./runtimePackageSource";

/**
 * Server-only model service lifecycle for TASK-047. Next.js route handlers
 * have no single reliable app-wide startup hook across dev/build/production
 * (and none at all for a serverless deployment target), so this uses
 * lazy-load-on-first-request: the first call to `getReadyModelService()` in
 * this process triggers `PredictionService.start()` once; every later call
 * (from any route) reuses the same validated, self-tested model instance —
 * satisfying "one validated model instance reused across requests, no
 * artifact read per prediction" without inventing a custom server entry
 * point this repository doesn't otherwise have.
 *
 * A failed load never throws here — `start()` only throws when
 * `MODEL_INFERENCE_REQUIRE_MODEL_ON_START=true` (an existing TASK-046
 * config this task reuses rather than duplicating), and even then the
 * caller (readiness/predict adapters) is expected to catch it and report a
 * structured `model_unavailable`, never crash the app.
 */

let instance: PredictionService | null = null;
let startPromise: Promise<RegistrySnapshot> | null = null;
let placeholderInstance: PredictionService | null = null;

function buildLocalGeneratedInstance(): PredictionService {
  return new PredictionService(loadModelInferenceConfig());
}

/**
 * Used only when a caller needs a `PredictionService` object without forcing
 * any load attempt: `getModelServiceSnapshotSync()`, and as `getReadyModelService()`'s
 * fallback when (in `"runtime-package"` source mode) the runtime package
 * itself failed to load — its own `runtime_package_*` error has already been
 * surfaced elsewhere (`historicalFeatureRepository.ts`'s dataset cache, or
 * `readiness.ts`'s `historicalDataAvailable` check), so this placeholder's
 * job is only to report a normal "unloaded" registry snapshot rather than
 * to ever attempt an actual model load against a package that isn't there.
 */
function getPlaceholderInstance(): PredictionService {
  if (!placeholderInstance) placeholderInstance = buildLocalGeneratedInstance();
  return placeholderInstance;
}

/** Builds (once) the real `PredictionService` for the currently configured source mode. In `"runtime-package"` mode this awaits the shared, memoized `getRuntimePackage()` load — the same one-time validation `historicalFeatureRepository.ts` depends on for historical rows — and points the service at `<package>/model` (TASK-048 Decision B: no new `ArtifactSource` implementation is needed, since `LocalFilesystemArtifactSource` already reads a flat directory of the 5 approved filenames, which is exactly what `runtime-package/model/` contains). May reject (e.g. `runtime_package_missing`) — callers must not let that reach a route as an unhandled rejection. */
async function buildInstanceForCurrentMode(): Promise<PredictionService> {
  const config = loadRealPredictionConfig();
  if (config.sourceMode !== "runtime-package") {
    return buildLocalGeneratedInstance();
  }
  const loaded = await getRuntimePackage();
  return new PredictionService(loadModelInferenceConfig(), new LocalFilesystemArtifactSource(loaded.modelDir));
}

async function getOrBuildInstance(): Promise<PredictionService> {
  if (instance) return instance;
  instance = await buildInstanceForCurrentMode();
  return instance;
}

/** Triggers (once) and awaits the model's startup load; safe to call from every route on every request. Never throws — a runtime-package load failure or a failed model load both surface as a normal "unloaded"/"failed" snapshot via the returned service's `.readiness()`, never an exception from this accessor. */
export async function getReadyModelService(): Promise<PredictionService> {
  if (!startPromise) {
    startPromise = getOrBuildInstance()
      .then((service) => service.start())
      .catch((error) => {
        // A required-on-start failure, or (in runtime-package mode) a
        // package load failure, still leaves a readiness snapshot
        // inspectable via the placeholder below — reset so a later request
        // can retry rather than being permanently stuck on one rejected
        // promise.
        startPromise = null;
        throw error;
      });
  }
  await startPromise.catch(() => {
    // Swallowed here: callers use `service.readiness()`/`service.predict()`
    // to observe the resulting not-ready state instead of an exception from
    // this accessor.
  });
  return instance ?? getPlaceholderInstance();
}

/** Synchronous accessor for callers that only need the current snapshot (e.g. readiness) without forcing a load attempt. */
export function getModelServiceSnapshotSync(): PredictionService {
  return instance ?? getPlaceholderInstance();
}

/** Test-only injection point — lets tests supply a `PredictionService` built over a fixture `ArtifactSource` instead of the real gitignored artifact directory. */
export function setModelServiceForTesting(service: PredictionService | null): void {
  instance = service;
  startPromise = null;
}
