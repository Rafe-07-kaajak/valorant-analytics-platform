import { loadCuratedFeatureSource, buildEventsById } from "./curatedSource";
import { runFeatureStateEngine } from "./stateEngine";
import type { RejectedMatch } from "./stateEngine";
import { buildFeatureFeasibilityAudit } from "./featureAudit";
import type { FeatureFeasibilityAudit } from "./featureAudit";
import { deriveCanonicalWindow } from "./canonicalWindow";
import type { CanonicalWindow } from "./canonicalWindow";
import { assignExcludedSplits, assignSplits, computeSplitBoundaries, computeWalkForwardFolds, partitionEligibleForSplitting, summarizeSplits } from "./splits";
import type { SplitAssignment, SplitSummary, WalkForwardFold } from "./splits";
import { validateFeatureRows, validateSplitAssignments } from "./featureValidation";
import type { ValidationResult } from "./featureValidation";
import { computeFeatureDatasetVersion, contentHashOfOmitting } from "./featureVersion";
import type { FeatureVersion } from "./featureVersion";
import { buildFeatureDatasetFiles, writeFeatureDataset } from "./featureExport";
import type { FeatureDatasetFiles } from "./featureExport";
import { FEATURE_CATALOG } from "./featureCatalog";
import { DISPLAY_ONLY_IDENTIFIER_FIELDS } from "./types";
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
  /** Overrides the canonical-window anchor event name. Defaults to the real Masters Toronto 2025 anchor; only tests exercising unrelated pipeline behavior with their own synthetic events should override this. */
  readonly canonicalWindowEventName?: string;
}

export interface FeatureBuildResult {
  readonly rows: readonly FeatureRow[];
  readonly rejected: readonly RejectedMatch[];
  readonly featureAudit: FeatureFeasibilityAudit;
  readonly canonicalWindow: CanonicalWindow;
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

  // Feature computation above already replayed the FULL curated history
  // (so Elo/form entering the canonical window are real and warmed up, not
  // reset) — only which rows are *eligible* for the split/ranking/replay
  // exposure is restricted here.
  const canonicalWindow = options.canonicalWindowEventName
    ? deriveCanonicalWindow(source.events, source.matches, options.canonicalWindowEventName)
    : deriveCanonicalWindow(source.events, source.matches);
  const { eligible, excluded } = partitionEligibleForSplitting(rows, canonicalWindow);

  const boundaries = computeSplitBoundaries(eligible);
  const eligibleSplitAssignments = assignSplits(eligible, boundaries);
  const excludedSplitAssignments = assignExcludedSplits(excluded);
  const splitAssignments = [...excludedSplitAssignments, ...eligibleSplitAssignments];
  const splitSummary = summarizeSplits(eligible, boundaries);
  const walkForwardFolds = computeWalkForwardFolds(eligible);

  const rowValidation = validateFeatureRows(rows, source.matches);
  const splitValidation = validateSplitAssignments(rows, splitAssignments);

  // Display-only identifiers (event/team names, match stage text — see
  // `types.ts`) are excluded from the row's own version hash: they carry no
  // ML signal and are never in a model's `requiredInputFields`, so a purely
  // cosmetic correction must never invalidate an already-trained/selected
  // model via a `feature_dataset_version_mismatch` for matches whose actual
  // feature values did not change. Mirrors `curate/curatedVersion.ts`'s
  // existing choice to version curated matches from `metadata.contentHash`
  // rather than the full enriched object.
  const version = computeFeatureDatasetVersion({
    sourceDatasetVersion: source.manifest.curatedDatasetVersion,
    eloConfig,
    rowContentHashes: rows.map((row) => contentHashOfOmitting(row, DISPLAY_ONLY_IDENTIFIER_FIELDS)),
  });

  const files = buildFeatureDatasetFiles({
    rows,
    rejected,
    featureCatalog: FEATURE_CATALOG,
    canonicalWindow,
    splitSummary,
    splitAssignments,
    walkForwardFolds,
    rowValidation,
    splitValidation,
    featureAudit,
    version,
    generatedAt,
  });

  return { rows, rejected, featureAudit, canonicalWindow, splitSummary, splitAssignments, walkForwardFolds, rowValidation, splitValidation, version, files };
}

/** Runs the full build and writes every file under `<dataDir>/features/`. Returns the build result plus each file's content hash (for idempotency verification). */
export async function runFeatureBuildAndWrite(dataDir: string, options: FeatureBuildOptions = {}): Promise<FeatureBuildResult & { readonly fileHashes: Record<string, string> }> {
  const result = await runFeatureBuild(dataDir, options);
  const fileHashes = await writeFeatureDataset(dataDir, result.files);
  return { ...result, fileHashes };
}
