import { createHash } from "node:crypto";
import type { RuntimePackageFileEntry } from "./runtimePackageTypes";

/**
 * Deterministic runtime-package versioning — mirrors
 * `services/vlr-ingestion/src/modeling/modelVersion.ts`'s
 * `computeModelVersion` exactly: the same model artifact + the same
 * historical export always reproduce the same `runtimePackageVersion` —
 * never a random UUID, never dependent on `generatedAt`. This is what makes
 * `pnpm runtime:package:build` idempotent: running it twice against
 * unchanged source data yields the same version and the same per-file
 * hashes, even though `generatedAt` differs each run.
 */
export const RUNTIME_PACKAGE_RULES_VERSION = "runtime-package-rules@1.0.0";

export interface RuntimePackageVersionInputs {
  readonly modelVersion: string;
  readonly sourceFeatureDatasetVersion: string;
  readonly featureSchemaVersion: string;
  readonly featureRulesVersion: string;
  readonly modelFiles: readonly RuntimePackageFileEntry[];
  readonly historicalFiles: readonly RuntimePackageFileEntry[];
  readonly historicalRowCount: number;
  readonly historicalCatalogCount: number;
}

function sortedFileHashes(files: readonly RuntimePackageFileEntry[]): readonly (readonly [string, string])[] {
  return [...files].sort((a, b) => a.fileName.localeCompare(b.fileName)).map((file) => [file.fileName, file.sha256] as const);
}

export function computeRuntimePackageVersion(inputs: RuntimePackageVersionInputs): string {
  const canonical = JSON.stringify({
    packageRulesVersion: RUNTIME_PACKAGE_RULES_VERSION,
    modelVersion: inputs.modelVersion,
    sourceFeatureDatasetVersion: inputs.sourceFeatureDatasetVersion,
    featureSchemaVersion: inputs.featureSchemaVersion,
    featureRulesVersion: inputs.featureRulesVersion,
    modelFileHashes: sortedFileHashes(inputs.modelFiles),
    historicalFileHashes: sortedFileHashes(inputs.historicalFiles),
    historicalRowCount: inputs.historicalRowCount,
    historicalCatalogCount: inputs.historicalCatalogCount,
  });
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}
