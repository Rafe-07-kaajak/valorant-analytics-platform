import { readFile } from "node:fs/promises";
import { resolveSafePath, safeFileName } from "@repo/vlr-ingestion/persistence/pathSafety";
import { PredictionApiError } from "./errors";
import { loadRealPredictionConfig } from "./config";
import { getRuntimePackage } from "./runtimePackageSource";

/**
 * Server-only historical feature-row repository — TASK-047 requirement 5.
 * Reads TASK-044's own `features/feature-rows.json` export exactly as
 * produced (never mutates it, never reads `curated/` directly). Every field
 * on a `RawHistoricalRow` is whatever TASK-044 exported for that row —
 * identifiers, lineage, labels, and the ~161 model-input features are all
 * present on the same flat object, matching the canonical feature-row
 * schema documented in docs/32.
 *
 * Security note: `matchInternalId` (a request-supplied value once this
 * reaches the API layer) is used **only** as a lookup key against this
 * already-loaded, in-memory `Map` — it is never interpolated into a
 * filesystem path, so path traversal via a match ID is not a code path that
 * exists here at all.
 */

export interface RawHistoricalRow {
  readonly matchInternalId: string;
  readonly scheduledAt: string;
  readonly eventInternalId: string;
  readonly eventFamily: string;
  readonly eventRegion: string;
  readonly eventStage: string;
  readonly tournamentLevel: string;
  readonly seriesFormat: string;
  readonly teamAProviderId: string;
  readonly teamBProviderId: string;
  readonly featureSchemaVersion: string;
  readonly featureRulesVersion: string;
  readonly sourceDatasetVersion: string;
  /**
   * Present when `sourceMode` is `"local-generated"` (TASK-044's own export
   * carries labels as-is, even though they are never copied into a model
   * request or catalog entry — see `predictionAdapter.ts`). Absent when
   * `sourceMode` is `"runtime-package"` (TASK-048): the packaged historical
   * export strips every label field before it ever reaches disk, so there is
   * nothing here to leak by construction, not by a manually-maintained
   * exclusion list.
   */
  readonly labelTeamAWin?: 0 | 1;
  readonly labelWinnerProviderId?: string;
  readonly labelSeriesScore?: string;
  readonly labelMapCountPlayed?: number;
  readonly [field: string]: unknown;
}

export interface FeatureDatasetManifestSummary {
  readonly featureDatasetVersion: string;
  readonly featureSchemaVersion: string;
  readonly featureRulesVersion: string;
  readonly rowCount: number;
}

interface DatasetCache {
  readonly manifest: FeatureDatasetManifestSummary;
  readonly rowsById: ReadonlyMap<string, RawHistoricalRow>;
  readonly orderedRows: readonly RawHistoricalRow[];
}

let cache: DatasetCache | null = null;

async function readDatasetJsonFile<T>(featuresDir: string, fileName: string): Promise<T> {
  // `fileName` is always one of this module's own two fixed literals below —
  // `safeFileName`/`resolveSafePath` are applied anyway as defense-in-depth,
  // consistent with every other filesystem access in this repository.
  const path = resolveSafePath(featuresDir, safeFileName(fileName));
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw) as T;
}

function toDatasetCache(manifest: FeatureDatasetManifestSummary, rows: readonly RawHistoricalRow[]): DatasetCache {
  const rowsById = new Map<string, RawHistoricalRow>();
  for (const row of rows) {
    if (typeof row.matchInternalId !== "string" || row.matchInternalId.length === 0) {
      throw new PredictionApiError("feature_row_invalid", "A historical feature row is missing a valid matchInternalId.");
    }
    if (rowsById.has(row.matchInternalId)) {
      throw new PredictionApiError("feature_row_invalid", "The historical feature dataset contains a duplicate matchInternalId.");
    }
    rowsById.set(row.matchInternalId, row);
  }
  return { manifest, rowsById, orderedRows: rows };
}

/** TASK-047 behavior, unchanged: reads TASK-044's own `features/{feature-manifest.json,feature-rows.json}` export directly. */
async function loadLocalGeneratedDataset(featureDataDir: string): Promise<DatasetCache> {
  const featuresDir = resolveSafePath(featureDataDir, "features");

  let manifest: FeatureDatasetManifestSummary;
  let rows: RawHistoricalRow[];
  try {
    [manifest, rows] = await Promise.all([
      readDatasetJsonFile<FeatureDatasetManifestSummary>(featuresDir, "feature-manifest.json"),
      readDatasetJsonFile<RawHistoricalRow[]>(featuresDir, "feature-rows.json"),
    ]);
  } catch {
    throw new PredictionApiError(
      "historical_data_unavailable",
      "The historical feature dataset is not available locally. Run the VLR feature pipeline (`pnpm ingest:vlr:features:build`) to enable historical model replay.",
    );
  }

  return toDatasetCache(manifest, rows);
}

/** TASK-048: reads the already-validated, label-stripped historical export from the loaded runtime package instead of the raw generated directory. `getRuntimePackage()` performs its own hash/version-agreement validation once per process; this function only re-shapes the result into the same `DatasetCache` the rest of this file already understands, so `historicalCatalog.ts`/`predictionAdapter.ts` need zero changes for this source mode. */
async function loadRuntimePackageDataset(): Promise<DatasetCache> {
  const loaded = await getRuntimePackage();
  const manifest: FeatureDatasetManifestSummary = {
    featureDatasetVersion: loaded.historicalManifest.sourceFeatureDatasetVersion,
    featureSchemaVersion: loaded.historicalManifest.featureSchemaVersion,
    featureRulesVersion: loaded.historicalManifest.featureRulesVersion,
    rowCount: loaded.historicalManifest.rowCount,
  };
  return toDatasetCache(manifest, loaded.historicalRows as readonly RawHistoricalRow[]);
}

async function loadDataset(): Promise<DatasetCache> {
  const config = loadRealPredictionConfig();
  return config.sourceMode === "runtime-package" ? loadRuntimePackageDataset() : loadLocalGeneratedDataset(config.featureDataDir);
}

/** Memoized for the lifetime of this process — reloaded only via `resetHistoricalRepositoryCacheForTesting()`. No public route triggers a reload (TASK-047 requirement 17, "no public reload route"). */
async function getCachedDataset(): Promise<DatasetCache> {
  if (cache) return cache;
  cache = await loadDataset();
  return cache;
}

export function resetHistoricalRepositoryCacheForTesting(): void {
  cache = null;
}

/** Returns `null` (never throws) when the dataset is unavailable — used by readiness, which must never fail the request. */
export async function getFeatureDatasetManifestSafe(): Promise<FeatureDatasetManifestSummary | null> {
  try {
    const dataset = await getCachedDataset();
    return dataset.manifest;
  } catch {
    return null;
  }
}

const MAX_MATCH_ID_LENGTH = 256;

export function validateMatchInternalId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > MAX_MATCH_ID_LENGTH) {
    throw new PredictionApiError("request_invalid", "matchInternalId must be a non-empty string.");
  }
  return value;
}

/** Strips label fields before the row is ever handed to inference-request construction — see `predictionAdapter.ts`. */
export async function getHistoricalRowById(matchInternalId: string): Promise<RawHistoricalRow> {
  const dataset = await getCachedDataset();
  const row = dataset.rowsById.get(matchInternalId);
  if (!row) {
    throw new PredictionApiError("historical_match_not_found", `No historical match found for the given identifier.`);
  }
  return row;
}

export async function listHistoricalRows(): Promise<readonly RawHistoricalRow[]> {
  const dataset = await getCachedDataset();
  return dataset.orderedRows;
}
