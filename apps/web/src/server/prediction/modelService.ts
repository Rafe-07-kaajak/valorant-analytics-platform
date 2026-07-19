import { PredictionService, loadModelInferenceConfig, type RegistrySnapshot } from "@repo/model-inference";

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

function getInstance(): PredictionService {
  if (!instance) {
    instance = new PredictionService(loadModelInferenceConfig());
  }
  return instance;
}

/** Triggers (once) and awaits the model's startup load; safe to call from every route on every request. */
export async function getReadyModelService(): Promise<PredictionService> {
  const service = getInstance();
  if (!startPromise) {
    startPromise = service.start().catch((error) => {
      // A required-on-start failure still leaves the registry snapshot
      // inspectable (readiness/predict paths report it structurally) —
      // reset so a later request can retry the load rather than being
      // permanently stuck on one rejected promise.
      startPromise = null;
      throw error;
    });
  }
  await startPromise.catch(() => {
    // Swallowed here: callers use `service.readiness()`/`service.predict()`
    // to observe the resulting not-ready state instead of an exception from
    // this accessor. `MODEL_INFERENCE_REQUIRE_MODEL_ON_START` callers that
    // truly want a thrown error can inspect `getModelServiceSnapshotSync()`.
  });
  return service;
}

/** Synchronous accessor for callers that only need the current snapshot (e.g. readiness) without forcing a load attempt. */
export function getModelServiceSnapshotSync(): PredictionService {
  return getInstance();
}

/** Test-only injection point — lets tests supply a `PredictionService` built over a fixture `ArtifactSource` instead of the real gitignored artifact directory. */
export function setModelServiceForTesting(service: PredictionService | null): void {
  instance = service;
  startPromise = null;
}
