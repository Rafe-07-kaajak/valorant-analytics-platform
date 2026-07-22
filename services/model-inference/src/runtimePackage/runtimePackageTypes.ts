/**
 * Shared TypeScript contracts for TASK-048's runtime packaging feature.
 * These types describe the on-disk shape of a "runtime package": a
 * gitignored, staged copy of the currently-selected model artifact plus a
 * label-stripped historical replay export, suitable for mounting into a
 * container/server deployment without requiring the full local `.local/`
 * generated-data tree to exist there.
 */

export const RUNTIME_PACKAGE_MODEL_FILENAMES = ["model.json", "preprocessing.json", "calibration.json", "feature-contract.json", "model-manifest.json"] as const;

export const RUNTIME_PACKAGE_HISTORICAL_FILENAMES = ["historical-index.json", "historical-rows.json", "historical-manifest.json"] as const;

export const RUNTIME_PACKAGE_MANIFEST_FILENAME = "manifest.json";

export type RuntimePackageModelFilename = (typeof RUNTIME_PACKAGE_MODEL_FILENAMES)[number];
export type RuntimePackageHistoricalFilename = (typeof RUNTIME_PACKAGE_HISTORICAL_FILENAMES)[number];

export interface RuntimePackageFileEntry {
  readonly fileName: string;
  readonly sha256: string;
  readonly sizeBytes: number;
}

export interface RuntimePackageSizeSummary {
  readonly modelTotalBytes: number;
  readonly historicalTotalBytes: number;
  readonly manifestBytes: number;
  readonly grandTotalBytes: number;
}

/** The package's supported/conditional/unsupported runtime-target classification — see docs/36, "Deployment feasibility audit". */
export interface RuntimePackageTargetSupport {
  readonly supported: readonly string[];
  readonly conditional: readonly string[];
  readonly unsupported: readonly string[];
}

export interface RuntimePackageManifest {
  readonly packageRulesVersion: string;
  /** Deterministic content-hash-derived version — independent of `generatedAt`. Rebuilding from unchanged source data always reproduces the same value. */
  readonly runtimePackageVersion: string;
  /** Informational only — excluded from `runtimePackageVersion`'s hash input. */
  readonly generatedAt: string;
  readonly modelVersion: string;
  readonly estimatorType: string;
  readonly calibrationMethod: string;
  readonly sourceFeatureDatasetVersion: string;
  readonly featureSchemaVersion: string;
  readonly featureRulesVersion: string;
  readonly model: { readonly files: readonly RuntimePackageFileEntry[] };
  readonly historical: {
    readonly files: readonly RuntimePackageFileEntry[];
    readonly rowCount: number;
    readonly catalogCount: number;
  };
  readonly minimumRuntimeNodeVersion: string;
  readonly runtimeTargets: RuntimePackageTargetSupport;
  readonly sizeSummaryBytes: RuntimePackageSizeSummary;
}

/** Safe, browser-eligible catalog entry — deliberately the same shape as `@repo/shared`'s `HistoricalMatchSummary` (duplicated here rather than depending on `@repo/shared`, since this package is intentionally provider/consumer-agnostic — see docs/34, "Why a new package"). No label, score, or feature-value fields. */
export interface RuntimeHistoricalIndexEntry {
  readonly matchInternalId: string;
  readonly scheduledAt: string;
  readonly eventFamily: string;
  readonly eventName: string;
  readonly eventRegion: string;
  readonly tournamentLevel: string;
  readonly seriesFormat: string;
  readonly teamAProviderId: string;
  readonly teamBProviderId: string;
  readonly teamADisplayName: string;
  readonly teamBDisplayName: string;
  readonly matchStageDisplay: string;
  readonly modelEligible: boolean;
  readonly featureDatasetVersion: string;
}

/** Label-stripped row: safe metadata + exactly the model's `requiredInputFields`. Never contains `labelTeamAWin`/`labelWinnerProviderId`/`labelSeriesScore`/`labelMapCountPlayed` or split/fold assignment fields. */
export interface RuntimeHistoricalRow {
  readonly matchInternalId: string;
  readonly scheduledAt: string;
  readonly eventInternalId: string;
  readonly eventFamily: string;
  readonly eventName: string;
  readonly eventRegion: string;
  readonly eventStage: string;
  readonly tournamentLevel: string;
  readonly seriesFormat: string;
  readonly teamAProviderId: string;
  readonly teamBProviderId: string;
  readonly teamADisplayName: string;
  readonly teamBDisplayName: string;
  readonly matchStageDisplay: string;
  readonly sourceDatasetVersion: string;
  readonly featureSchemaVersion: string;
  readonly featureRulesVersion: string;
  readonly [inputField: string]: unknown;
}

export interface RuntimeHistoricalManifest {
  readonly sourceFeatureDatasetVersion: string;
  readonly featureSchemaVersion: string;
  readonly featureRulesVersion: string;
  readonly rowCount: number;
  readonly catalogCount: number;
  readonly requiredInputFieldCount: number;
}

export interface RuntimePackageFiles {
  readonly manifest: RuntimePackageManifest;
  readonly historicalIndex: readonly RuntimeHistoricalIndexEntry[];
  readonly historicalRows: readonly RuntimeHistoricalRow[];
  readonly historicalManifest: RuntimeHistoricalManifest;
}
