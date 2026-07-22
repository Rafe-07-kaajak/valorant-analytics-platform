import { readFile } from "node:fs/promises";
import { resolveSafePath, safeFileName } from "@repo/vlr-ingestion";
import { RuntimePackageError } from "./runtimePackageErrors";
import type { RuntimeHistoricalIndexEntry, RuntimeHistoricalManifest, RuntimeHistoricalRow } from "./runtimePackageTypes";

/**
 * Builds a runtime-safe historical replay export from TASK-044's own
 * `features/{feature-manifest.json,feature-rows.json}` output — TASK-048.
 * Retains only safe display metadata plus exactly the currently-selected
 * model's `requiredInputFields`; strips every label field
 * (`labelTeamAWin`/`labelWinnerProviderId`/`labelSeriesScore`/
 * `labelMapCountPlayed`), split/fold assignment, and every other field TASK-
 * 044 exports that the runtime doesn't need. Source files are only ever
 * read here, never mutated.
 */

const SAFE_METADATA_FIELDS = [
  "matchInternalId",
  "scheduledAt",
  "eventInternalId",
  "eventFamily",
  "eventName",
  "eventRegion",
  "eventStage",
  "tournamentLevel",
  "seriesFormat",
  "teamAProviderId",
  "teamBProviderId",
  "teamADisplayName",
  "teamBDisplayName",
  "matchStageDisplay",
  "sourceDatasetVersion",
  "featureSchemaVersion",
  "featureRulesVersion",
] as const;

interface SourceFeatureManifest {
  readonly featureDatasetVersion: string;
  readonly featureSchemaVersion: string;
  readonly featureRulesVersion: string;
  readonly rowCount: number;
}

export interface HistoricalExportContract {
  readonly requiredInputFields: readonly string[];
  readonly nullableNumericFields: readonly string[];
}

export interface HistoricalExportResult {
  readonly index: readonly RuntimeHistoricalIndexEntry[];
  readonly rows: readonly RuntimeHistoricalRow[];
  readonly manifest: RuntimeHistoricalManifest;
}

async function readSourceJson<T>(featuresDir: string, fileName: string): Promise<T> {
  const path = resolveSafePath(featuresDir, safeFileName(fileName));
  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch {
    throw new RuntimePackageError("runtime_package_build_failed", `Source feature dataset file "${fileName}" is not available at the configured source directory.`);
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new RuntimePackageError("runtime_package_build_failed", `Source feature dataset file "${fileName}" is not valid JSON.`);
  }
}

function requireString(row: Record<string, unknown>, field: string, matchInternalId: string): string {
  const value = row[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new RuntimePackageError("runtime_package_build_failed", `Historical row "${matchInternalId}" is missing required safe-metadata field "${field}".`, { details: { matchInternalId, field } });
  }
  return value;
}

function projectRow(row: Record<string, unknown>, contract: HistoricalExportContract): RuntimeHistoricalRow {
  const rawMatchId = row.matchInternalId;
  const matchInternalId = typeof rawMatchId === "string" ? rawMatchId : "(unknown)";

  const nullableSet = new Set(contract.nullableNumericFields);
  const projected: Record<string, unknown> = {};

  for (const field of SAFE_METADATA_FIELDS) {
    projected[field] = requireString(row, field, matchInternalId);
  }

  for (const field of contract.requiredInputFields) {
    if (!Object.prototype.hasOwnProperty.call(row, field)) {
      throw new RuntimePackageError("runtime_package_build_failed", `Historical row "${matchInternalId}" is missing required model input field "${field}".`, { details: { matchInternalId, field } });
    }
    const value = row[field];
    if (value === null) {
      if (!nullableSet.has(field)) {
        throw new RuntimePackageError("runtime_package_build_failed", `Historical row "${matchInternalId}" has a null value for non-nullable field "${field}".`, { details: { matchInternalId, field } });
      }
      projected[field] = null;
      continue;
    }
    if (value === undefined) {
      throw new RuntimePackageError("runtime_package_build_failed", `Historical row "${matchInternalId}" is missing required model input field "${field}".`, { details: { matchInternalId, field } });
    }
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new RuntimePackageError("runtime_package_build_failed", `Historical row "${matchInternalId}" has a non-finite value for field "${field}".`, { details: { matchInternalId, field } });
    }
    projected[field] = value;
  }

  return projected as RuntimeHistoricalRow;
}

function toIndexEntry(row: RuntimeHistoricalRow, featureDatasetVersion: string): RuntimeHistoricalIndexEntry {
  return {
    matchInternalId: row.matchInternalId,
    scheduledAt: row.scheduledAt,
    eventFamily: row.eventFamily,
    eventName: row.eventName,
    eventRegion: row.eventRegion,
    tournamentLevel: row.tournamentLevel,
    seriesFormat: row.seriesFormat,
    teamAProviderId: row.teamAProviderId,
    teamBProviderId: row.teamBProviderId,
    teamADisplayName: row.teamADisplayName,
    teamBDisplayName: row.teamBDisplayName,
    matchStageDisplay: row.matchStageDisplay,
    modelEligible: true,
    featureDatasetVersion,
  };
}

/** Stable chronological order, tie-break `matchInternalId` — mirrors `apps/web/src/server/prediction/historicalCatalog.ts`'s existing comparator so packaged and local-generated catalogs are ordered identically. */
function compareRows(a: RuntimeHistoricalRow, b: RuntimeHistoricalRow): number {
  if (a.scheduledAt !== b.scheduledAt) return a.scheduledAt < b.scheduledAt ? -1 : 1;
  return a.matchInternalId.localeCompare(b.matchInternalId);
}

export async function buildHistoricalExport(sourceFeatureDataDir: string, contract: HistoricalExportContract): Promise<HistoricalExportResult> {
  const featuresDir = resolveSafePath(sourceFeatureDataDir, "features");
  const [manifest, rawRows] = await Promise.all([readSourceJson<SourceFeatureManifest>(featuresDir, "feature-manifest.json"), readSourceJson<Record<string, unknown>[]>(featuresDir, "feature-rows.json")]);

  const seenIds = new Set<string>();
  const projected: RuntimeHistoricalRow[] = [];
  for (const row of rawRows) {
    const matchInternalId = row.matchInternalId;
    if (typeof matchInternalId !== "string" || matchInternalId.length === 0) {
      throw new RuntimePackageError("runtime_package_build_failed", "A source historical row is missing a valid matchInternalId.");
    }
    if (seenIds.has(matchInternalId)) {
      throw new RuntimePackageError("runtime_package_build_failed", `Duplicate matchInternalId "${matchInternalId}" found in the source feature dataset.`, { details: { matchInternalId } });
    }
    seenIds.add(matchInternalId);
    projected.push(projectRow(row, contract));
  }

  const sorted = [...projected].sort(compareRows);
  const index = sorted.map((row) => toIndexEntry(row, manifest.featureDatasetVersion));

  return {
    index,
    rows: sorted,
    manifest: {
      sourceFeatureDatasetVersion: manifest.featureDatasetVersion,
      featureSchemaVersion: manifest.featureSchemaVersion,
      featureRulesVersion: manifest.featureRulesVersion,
      rowCount: sorted.length,
      catalogCount: index.length,
      requiredInputFieldCount: contract.requiredInputFields.length,
    },
  };
}
