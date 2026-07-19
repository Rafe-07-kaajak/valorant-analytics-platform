import type { RealPredictionReadiness } from "@repo/shared";
import { getModelServiceSnapshotSync, getReadyModelService } from "./modelService";
import { getFeatureDatasetManifestSafe } from "./historicalFeatureRepository";
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

/** Triggers the model's lazy startup load (once per process) and returns a full readiness snapshot. */
export async function getRealPredictionReadiness(): Promise<RealPredictionReadiness> {
  const config = loadRealPredictionConfig();
  const service = config.enabled ? await getReadyModelService() : getModelServiceSnapshotSync();
  const snapshot = service.readiness();
  const manifest = await getFeatureDatasetManifestSafe();

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
  };
}
