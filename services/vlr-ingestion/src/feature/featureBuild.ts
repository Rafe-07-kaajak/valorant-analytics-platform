import { loadCuratedFeatureSource, buildEventsById } from "./curatedSource";
import { runFeatureStateEngine } from "./stateEngine";
import type { RejectedMatch } from "./stateEngine";
import { buildFeatureFeasibilityAudit } from "./featureAudit";
import type { FeatureFeasibilityAudit } from "./featureAudit";
import { assignSplits, computeSplitBoundaries, computeWalkForwardFolds, summarizeSplits } from "./splits";
import type { SplitAssignment, SplitSummary, WalkForwardFold } from "./splits";
import { validateFeatureRows, validateSplitAssignments } from "./featureValidation";
import type { ValidationResult } from "./featureValidation";
import { computeFeatureDatasetVersion, contentHashOf } from "./featureVersion";
import type { FeatureVersion } from "./featureVersion";
import { buildFeatureDatasetFiles, writeFeatureDataset } from "./featureExport";
import type { FeatureDatasetFiles } from "./featureExport";
import { FEATURE_CATALOG } from "./featureCatalog";
import type { FeatureRow } from "./types";
import { DEFAULT_ELO_CONFIG } from "./versions";
import type { EloConfig } from "./versions";

/**
 * Top-level TASK-044 orchestrator: loads the TASK-043 curated dataset,
 * replays it through the chronological feature-state engine, computes
 * labels/splits/folds/validation/versioning, and assembles every export
 * file — without writing anything (see `runFeatureBuildAndWrite` for the
 * writing step). Kept side-effect-free so CLI commands can compose it
 * freely (`audit`/`validate`/`status` never need to touch disk beyond
 * reading the curated input).
 */
export interface FeatureBuildOptions {
  readonly eloConfig?: EloConfig;
  readonly generatedAt?: string;
}

export interface FeatureBuildResult {
  readonly rows: readonly FeatureRow[];
  readonly rejected: readonly RejectedMatch[];
  readonly featureAudit: FeatureFeasibilityAudit;
  readonly splitSummary: SplitSummary;
  readonly splitAssignments: readonly SplitAssignment[];
  readonly walkForwardFolds: readonly WalkForwardFold[];
  readonly rowValidation: ValidationResult;
  readonly splitValidation: ValidationResult;
  readonly version: FeatureVersion;
  readonly files: FeatureDatasetFiles;
}

export async function runFeatureBuild(dataDir: string, options: FeatureBuildOptions = {}): Promise<FeatureBuildResult> {
  const eloConfig = options.eloConfig ?? DEFAULT_ELO_CONFIG;
  const generatedAt = options.generatedAt ?? new Date().toISOString();

  const source = await loadCuratedFeatureSource(dataDir);
  const eventsById = buildEventsById(source.events);

  const { rows, rejected } = runFeatureStateEngine(source.matches, eventsById, {
    eloConfig,
    sourceDatasetVersion: source.manifest.curatedDatasetVersion,
  });

  const featureAudit = buildFeatureFeasibilityAudit(source.matches, source.events, generatedAt);

  const boundaries = computeSplitBoundaries(rows);
  const splitAssignments = assignSplits(rows, boundaries);
  const splitSummary = summarizeSplits(rows, boundaries);
  const walkForwardFolds = computeWalkForwardFolds(rows);

  const rowValidation = validateFeatureRows(rows, source.matches);
  const splitValidation = validateSplitAssignments(rows, splitAssignments);

  const version = computeFeatureDatasetVersion({
    sourceDatasetVersion: source.manifest.curatedDatasetVersion,
    eloConfig,
    rowContentHashes: rows.map((row) => contentHashOf(row)),
  });

  const files = buildFeatureDatasetFiles({
    rows,
    rejected,
    featureCatalog: FEATURE_CATALOG,
    splitSummary,
    splitAssignments,
    walkForwardFolds,
    rowValidation,
    splitValidation,
    featureAudit,
    version,
    generatedAt,
  });

  return { rows, rejected, featureAudit, splitSummary, splitAssignments, walkForwardFolds, rowValidation, splitValidation, version, files };
}

/** Runs the full build and writes every file under `<dataDir>/features/`. Returns the build result plus each file's content hash (for idempotency verification). */
export async function runFeatureBuildAndWrite(dataDir: string, options: FeatureBuildOptions = {}): Promise<FeatureBuildResult & { readonly fileHashes: Record<string, string> }> {
  const result = await runFeatureBuild(dataDir, options);
  const fileHashes = await writeFeatureDataset(dataDir, result.files);
  return { ...result, fileHashes };
}
