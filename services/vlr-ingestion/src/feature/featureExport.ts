import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";
import { resolveSafePath } from "../persistence/pathSafety";
import { stableStringify } from "../curate/curatedExport";
import { contentHashOf } from "./featureVersion";
import type { FeatureVersion } from "./featureVersion";
import type { FeatureRow } from "./types";
import type { FeatureFieldMeta } from "./featureCatalog";
import type { SplitAssignment, SplitSummary } from "./splits";
import type { WalkForwardFold } from "./splits";
import type { CanonicalWindow } from "./canonicalWindow";
import type { ValidationResult } from "./featureValidation";
import type { RejectedMatch } from "./stateEngine";
import { countFeatureFields } from "./featureCatalog";

/**
 * Deterministic feature-dataset export — TASK-044 requirement 21. Mirrors
 * `curate/curatedExport.ts`'s pattern: stable key ordering, atomic writes,
 * content hashes returned for idempotency verification. Every file is
 * written under `<dataDir>/features/`, which is gitignored (see
 * `.gitignore` — the same rule that already covers `.local/vlr-data/`).
 */
export const FEATURE_DIR_SEGMENTS = ["features"] as const;

export interface FeatureManifest {
  readonly featureDatasetVersion: string;
  readonly featureSchemaVersion: string;
  readonly featureRulesVersion: string;
  readonly ratingConfigVersion: string;
  readonly sourceDatasetVersion: string;
  readonly generatedAt: string;
  readonly rowCount: number;
  readonly featureCount: number;
  readonly targetCount: number;
  readonly rejectedMatchCount: number;
  readonly trainRowCount: number;
  readonly validationRowCount: number;
  readonly testRowCount: number;
  readonly excludedRowCount: number;
  readonly walkForwardFoldCount: number;
  readonly validationErrorCount: number;
  readonly validationWarningCount: number;
}

export interface CanonicalWindowFile extends CanonicalWindow {
  readonly derivedAt: string;
}

export interface FeatureDatasetFiles {
  readonly "feature-rows.json": readonly FeatureRow[];
  readonly "feature-rows.jsonl": string;
  readonly "labels.json": readonly Pick<FeatureRow, "matchInternalId" | "labelTeamAWin" | "labelWinnerProviderId" | "labelSeriesScore" | "labelMapCountPlayed">[];
  readonly "feature-catalog.json": readonly FeatureFieldMeta[];
  readonly "canonical-window.json": CanonicalWindowFile;
  readonly "split-assignments.json": { readonly summary: SplitSummary; readonly assignments: readonly SplitAssignment[] };
  readonly "walk-forward-folds.json": readonly WalkForwardFold[];
  readonly "feature-validation.json": { readonly rows: ValidationResult; readonly splits: ValidationResult; readonly rejected: readonly RejectedMatch[] };
  readonly "feature-manifest.json": FeatureManifest;
  readonly "feature-audit.json": unknown;
}

export interface BuildFeatureDatasetFilesInput {
  readonly rows: readonly FeatureRow[];
  readonly rejected: readonly RejectedMatch[];
  readonly featureCatalog: readonly FeatureFieldMeta[];
  readonly canonicalWindow: CanonicalWindow;
  readonly splitSummary: SplitSummary;
  readonly splitAssignments: readonly SplitAssignment[];
  readonly walkForwardFolds: readonly WalkForwardFold[];
  readonly rowValidation: ValidationResult;
  readonly splitValidation: ValidationResult;
  readonly featureAudit: unknown;
  readonly version: FeatureVersion;
  readonly generatedAt: string;
}

function toJsonLines(rows: readonly FeatureRow[]): string {
  return `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
}

export function buildFeatureDatasetFiles(input: BuildFeatureDatasetFilesInput): FeatureDatasetFiles {
  const labels = input.rows.map((row) => ({
    matchInternalId: row.matchInternalId,
    labelTeamAWin: row.labelTeamAWin,
    labelWinnerProviderId: row.labelWinnerProviderId,
    labelSeriesScore: row.labelSeriesScore,
    labelMapCountPlayed: row.labelMapCountPlayed,
  }));

  const featureCount = countFeatureFields();

  const manifest: FeatureManifest = {
    featureDatasetVersion: input.version.featureDatasetVersion,
    featureSchemaVersion: input.version.featureSchemaVersion,
    featureRulesVersion: input.version.featureRulesVersion,
    ratingConfigVersion: input.version.ratingConfigVersion,
    sourceDatasetVersion: input.version.sourceDatasetVersion,
    generatedAt: input.generatedAt,
    rowCount: input.rows.length,
    featureCount,
    targetCount: 4,
    rejectedMatchCount: input.rejected.length,
    trainRowCount: input.splitSummary.boundaries.trainRowCount,
    validationRowCount: input.splitSummary.boundaries.validationRowCount,
    testRowCount: input.splitSummary.boundaries.testRowCount,
    excludedRowCount: input.splitAssignments.filter((a) => a.split === "excluded").length,
    walkForwardFoldCount: input.walkForwardFolds.length,
    validationErrorCount: input.rowValidation.errors.length + input.splitValidation.errors.length,
    validationWarningCount: input.rowValidation.warnings.length + input.splitValidation.warnings.length,
  };

  return {
    "feature-rows.json": input.rows,
    "feature-rows.jsonl": toJsonLines(input.rows),
    "labels.json": labels,
    "feature-catalog.json": input.featureCatalog,
    "canonical-window.json": { ...input.canonicalWindow, derivedAt: input.generatedAt },
    "split-assignments.json": { summary: input.splitSummary, assignments: input.splitAssignments },
    "walk-forward-folds.json": input.walkForwardFolds,
    "feature-validation.json": { rows: input.rowValidation, splits: input.splitValidation, rejected: input.rejected },
    "feature-manifest.json": manifest,
    "feature-audit.json": input.featureAudit,
  };
}

async function writeFileAtomic(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${randomBytes(6).toString("hex")}`;
  await writeFile(tempPath, content, "utf-8");
  await rename(tempPath, filePath);
}

/** Writes every feature-dataset file under `<dataDir>/features/`. Returns each file's content hash for idempotency verification. Never touches curated source files. */
export async function writeFeatureDataset(dataDir: string, files: FeatureDatasetFiles): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  for (const [fileName, value] of Object.entries(files)) {
    const path = resolveSafePath(dataDir, ...FEATURE_DIR_SEGMENTS, fileName);
    const serialized = fileName.endsWith(".jsonl") ? (value as string) : stableStringify(value);
    await writeFileAtomic(path, serialized);
    hashes[fileName] = contentHashOf(value);
  }
  return hashes;
}
