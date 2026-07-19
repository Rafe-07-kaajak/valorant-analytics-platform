import type { RealPredictionReadiness } from "@repo/shared";
import { getModelServiceSnapshotSync, getReadyModelService } from "./modelService";
import { getFeatureDatasetManifestSafe } from "./historicalFeatureRepository";
import { getRuntimePackage } from "./runtimePackageSource";
import { loadRealPredictionConfig } from "./config";

/**
 * Browser-safe readiness snapshot — TASK-047 requirement 16. Never exposes
 * artifact paths, filesystem errors, or raw registry internals; only the
 * fields a UI needs to decide whether to offer historical-real-model mode.
 */

function messageFor(realPredictionAvailable: boolean, modelStatus: string, historicalDataAvailable: boolean, enabled: boolean): { message: string; retryable: boolean } {
  if (!enabled) return { message: "Real (historical-replay) prediction is disabled by configuration.", retryable: false };
  if (realPredictionAvailable) return { message: "Historical model replay is available.", retryable: false };
  if (!historicalDataAvailable) return { message: "The historical feature dataset is not available locally.", retryable: true };
  if (modelStatus === "loading") return { message: "The prediction model is still loading.", retryable: true };
  return { message: "The prediction model is not currently available.", retryable: true };
}

/** TASK-048: best-effort runtime package version for display — `undefined` when not in `"runtime-package"` mode or when the package failed to load (that failure already surfaces via `historicalDataAvailable`/`modelStatus` below, so this never throws). */
async function getRuntimePackageVersionSafe(sourceMode: RealPredictionReadiness["sourceMode"]): Promise<string | undefined> {
  if (sourceMode !== "runtime-package") return undefined;
  try {
    const loaded = await getRuntimePackage();
    return loaded.manifest.runtimePackageVersion;
  } catch {
    return undefined;
  }
}

/** Triggers the model's lazy startup load (once per process) and returns a full readiness snapshot. */
export async function getRealPredictionReadiness(): Promise<RealPredictionReadiness> {
  const config = loadRealPredictionConfig();
  const service = config.enabled ? await getReadyModelService() : getModelServiceSnapshotSync();
  const snapshot = service.readiness();
  const manifest = await getFeatureDatasetManifestSafe();
  const runtimePackageVersion = await getRuntimePackageVersionSafe(config.sourceMode);

  const historicalDataAvailable = manifest !== null;
  const realPredictionAvailable = config.enabled && snapshot.ready && historicalDataAvailable;
  const { message, retryable } = messageFor(realPredictionAvailable, snapshot.status, historicalDataAvailable, config.enabled);

  return {
    realPredictionAvailable,
    modelStatus: snapshot.status,
    historicalDataAvailable,
    ...(snapshot.modelVersion ? { currentModelVersion: snapshot.modelVersion } : {}),
    ...(manifest ? { sourceFeatureDatasetVersion: manifest.featureDatasetVersion } : {}),
    message,
    retryable,
    sourceMode: config.sourceMode,
    ...(runtimePackageVersion ? { runtimePackageVersion } : {}),
  };
}
