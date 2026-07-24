import { readFile } from "node:fs/promises";
import { resolveSafePath } from "../persistence/pathSafety";
import { ModelingError } from "./errors";
import type { FeatureRow } from "../feature/types";
import type { FeatureFieldMeta } from "../feature/featureCatalog";
import type { SplitAssignment, SplitSummary, WalkForwardFold } from "../feature/splits";
import type { FeatureManifest } from "../feature/featureExport";

/**
 * Read-only loader over TASK-044's feature-dataset export
 * (`<dataDir>/features/*.json`) — the only input TASK-045 reads. Never
 * touches `curated/` directly, never makes a network request, never
 * mutates a feature source file.
 */
export interface FeatureDatasetSource {
  readonly rows: readonly FeatureRow[];
  readonly catalog: readonly FeatureFieldMeta[];
  readonly manifest: FeatureManifest;
  readonly splitAssignments: readonly SplitAssignment[];
  readonly splitSummary: SplitSummary;
  readonly walkForwardFolds: readonly WalkForwardFold[];
}

async function readJson<T>(dataDir: string, fileName: string): Promise<T> {
  const path = resolveSafePath(dataDir, "features", fileName);
  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch {
    throw new ModelingError("dataset_not_found", `Feature dataset file "${fileName}" not found under "${dataDir}/features/". Run \`pnpm ingest:vlr:features:build\` first.`);
  }
  return JSON.parse(raw) as T;
}

export async function loadFeatureDatasetSource(dataDir: string): Promise<FeatureDatasetSource> {
  const [rows, catalog, manifest, splits, walkForwardFolds] = await Promise.all([
    readJson<FeatureRow[]>(dataDir, "feature-rows.json"),
    readJson<FeatureFieldMeta[]>(dataDir, "feature-catalog.json"),
    readJson<FeatureManifest>(dataDir, "feature-manifest.json"),
    readJson<{ summary: SplitSummary; assignments: SplitAssignment[] }>(dataDir, "split-assignments.json"),
    readJson<WalkForwardFold[]>(dataDir, "walk-forward-folds.json"),
  ]);
  return { rows, catalog, manifest, splitAssignments: splits.assignments, splitSummary: splits.summary, walkForwardFolds };
}

export interface SplitRows {
  readonly train: readonly FeatureRow[];
  readonly validation: readonly FeatureRow[];
  readonly test: readonly FeatureRow[];
}

/** Partitions rows by their recorded split assignment, preserving chronological order within each partition. */
export function partitionBySplit(rows: readonly FeatureRow[], assignments: readonly SplitAssignment[]): SplitRows {
  const splitByMatch = new Map(assignments.map((a) => [a.matchInternalId, a.split]));
  const train: FeatureRow[] = [];
  const validation: FeatureRow[] = [];
  const test: FeatureRow[] = [];
  for (const row of rows) {
    const split = splitByMatch.get(row.matchInternalId);
    if (split === "train") train.push(row);
    else if (split === "validation") validation.push(row);
    else if (split === "test") test.push(row);
    // "excluded" rows (before the canonical eligibility window — see
    // canonicalWindow.ts) are intentionally absent from every split, not an
    // error condition; only a genuinely missing assignment is.
    else if (split === "excluded") continue;
    else throw new ModelingError("schema_validation_failed", `Row ${row.matchInternalId} has no split assignment.`);
  }
  return { train, validation, test };
}

/** Selects rows by `matchInternalId`, preserving the order given in `ids` — used to materialize walk-forward fold train/validation subsets from the precomputed fold ID lists. */
export function selectRowsByIds(rowsById: ReadonlyMap<string, FeatureRow>, ids: readonly string[]): readonly FeatureRow[] {
  return ids.map((id) => {
    const row = rowsById.get(id);
    if (!row) throw new ModelingError("schema_validation_failed", `Walk-forward fold references unknown match ${id}.`);
    return row;
  });
}

export function buildRowsById(rows: readonly FeatureRow[]): ReadonlyMap<string, FeatureRow> {
  return new Map(rows.map((row) => [row.matchInternalId, row]));
}
