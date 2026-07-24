import { readFile } from "node:fs/promises";
import { resolveSafePath, safeFileName } from "@repo/vlr-ingestion/persistence/pathSafety";
import { buildTeamRealDataStates } from "@repo/vlr-ingestion";
import type { CanonicalWindow, FeatureRow, RealTeamPowerState } from "@repo/vlr-ingestion";
import { loadRealPredictionConfig } from "./config";

/**
 * Server-only Power Rankings real-data repository — real-data-correction
 * task. Reads TASK-044's own `features/{feature-manifest.json,feature-rows.json,canonical-window.json}`
 * export and TASK-043's `curated/identity-mappings.json`, both exactly as
 * produced, never mutated. Always reads the local-generated dataset
 * (`REAL_PREDICTION_FEATURE_DATA_DIR`) regardless of Historical Replay's
 * `sourceMode` — Power Rankings has no runtime-package concept of its own.
 * Returns `null` (never throws) when the dataset is unavailable, mirroring
 * `historicalFeatureRepository.ts`'s `getFeatureDatasetManifestSafe` — the
 * page falls back to the synthetic-scenario rankings in that case, still
 * honestly labeled as simulated by their own existing disclosure text.
 */

interface IdentityMappingEntry {
  readonly internalTeamId: string;
  readonly status: string;
}

interface IdentityMappingsFile {
  readonly teamMapping: readonly IdentityMappingEntry[];
}

interface FeatureManifestSummary {
  readonly featureDatasetVersion: string;
}

export interface PowerRankingsRealData {
  readonly states: ReadonlyMap<string, RealTeamPowerState>;
  readonly verifiedTeamIds: ReadonlySet<string>;
  readonly canonicalWindow: CanonicalWindow;
  readonly featureDatasetVersion: string;
}

let cache: PowerRankingsRealData | null = null;

async function readJsonFile<T>(dir: string, fileName: string): Promise<T> {
  const path = resolveSafePath(dir, safeFileName(fileName));
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw) as T;
}

async function loadPowerRankingsRealData(): Promise<PowerRankingsRealData> {
  const config = loadRealPredictionConfig();
  const featuresDir = resolveSafePath(config.featureDataDir, "features");
  const curatedDir = resolveSafePath(config.featureDataDir, "curated");

  const [manifest, rows, canonicalWindow, identityMappings] = await Promise.all([
    readJsonFile<FeatureManifestSummary>(featuresDir, "feature-manifest.json"),
    readJsonFile<FeatureRow[]>(featuresDir, "feature-rows.json"),
    readJsonFile<CanonicalWindow>(featuresDir, "canonical-window.json"),
    readJsonFile<IdentityMappingsFile>(curatedDir, "identity-mappings.json"),
  ]);

  const states = buildTeamRealDataStates(rows, canonicalWindow);
  const verifiedTeamIds = new Set(
    identityMappings.teamMapping.filter((entry) => entry.status === "verified").map((entry) => entry.internalTeamId),
  );

  return { states, verifiedTeamIds, canonicalWindow, featureDatasetVersion: manifest.featureDatasetVersion };
}

/** Memoized once successfully loaded (mirrors `historicalFeatureRepository.ts`'s `getCachedDataset`) — an unavailable dataset retries on every call rather than sticking a failure forever, so starting the feature pipeline while a dev server is already running is picked up without a restart. Reset via `resetPowerRankingsRepositoryCacheForTesting()`. */
export async function getPowerRankingsRealData(): Promise<PowerRankingsRealData | null> {
  if (cache) return cache;
  try {
    cache = await loadPowerRankingsRealData();
  } catch {
    return null;
  }
  return cache;
}

export function resetPowerRankingsRepositoryCacheForTesting(): void {
  cache = null;
}
