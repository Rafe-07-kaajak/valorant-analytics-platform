import { exportModelArtifact } from "./modelExport";
import { buildHistoricalExport } from "./historicalExport";
import type { RuntimePackageBuildConfig } from "./config";

/**
 * Read-only source-readiness audit — TASK-048. Runs *before* any build:
 * checks whether the source model artifact and source feature dataset are
 * present/valid and whether their schema/rules versions agree, without
 * writing anything. Distinct from `validate.ts`, which checks an
 * already-built package.
 */

export interface RuntimePackageAuditReport {
  readonly generatedAt: string;
  readonly sourceModelValid: boolean;
  readonly sourceModelError?: string;
  readonly sourceFeatureDatasetValid: boolean;
  readonly sourceFeatureDatasetError?: string;
  readonly versionsAgree: boolean | null;
  readonly modelVersion?: string;
  readonly estimatorType?: string;
  readonly sourceFeatureDatasetVersion?: string;
  readonly featureSchemaVersion?: string;
  readonly featureRulesVersion?: string;
  readonly historicalRowCount?: number;
  readonly readyToBuild: boolean;
}

export async function runRuntimePackageAudit(config: RuntimePackageBuildConfig): Promise<RuntimePackageAuditReport> {
  let modelVersion: string | undefined;
  let estimatorType: string | undefined;
  let modelFeatureSchemaVersion: string | undefined;
  let modelFeatureRulesVersion: string | undefined;
  let modelSourceFeatureDatasetVersion: string | undefined;
  let requiredInputFields: readonly string[] | undefined;
  let nullableNumericFields: readonly string[] | undefined;
  let sourceModelValid = false;
  let sourceModelError: string | undefined;

  try {
    const modelExport = await exportModelArtifact(config.sourceModelDir, config.maxFileBytes);
    sourceModelValid = true;
    modelVersion = modelExport.manifest.modelVersion;
    estimatorType = modelExport.manifest.estimatorType;
    modelFeatureSchemaVersion = modelExport.featureContract.featureSchemaVersion;
    modelFeatureRulesVersion = modelExport.featureContract.featureRulesVersion;
    modelSourceFeatureDatasetVersion = modelExport.manifest.sourceFeatureDatasetVersion;
    requiredInputFields = modelExport.featureContract.requiredInputFields;
    nullableNumericFields = modelExport.featureContract.nullableNumericFields;
  } catch (error) {
    sourceModelError = error instanceof Error ? error.message : "Unknown source model validation error.";
  }

  let sourceFeatureDatasetValid = false;
  let sourceFeatureDatasetError: string | undefined;
  let sourceFeatureDatasetVersion: string | undefined;
  let historicalFeatureSchemaVersion: string | undefined;
  let historicalFeatureRulesVersion: string | undefined;
  let historicalRowCount: number | undefined;

  if (requiredInputFields && nullableNumericFields) {
    try {
      const historicalExport = await buildHistoricalExport(config.sourceFeatureDataDir, { requiredInputFields, nullableNumericFields });
      sourceFeatureDatasetValid = true;
      sourceFeatureDatasetVersion = historicalExport.manifest.sourceFeatureDatasetVersion;
      historicalFeatureSchemaVersion = historicalExport.manifest.featureSchemaVersion;
      historicalFeatureRulesVersion = historicalExport.manifest.featureRulesVersion;
      historicalRowCount = historicalExport.manifest.rowCount;
    } catch (error) {
      sourceFeatureDatasetError = error instanceof Error ? error.message : "Unknown source feature dataset validation error.";
    }
  } else {
    sourceFeatureDatasetError = "Skipped: source model artifact must validate before the feature dataset can be checked against its feature contract.";
  }

  const versionsAgree = sourceModelValid && sourceFeatureDatasetValid ? modelFeatureSchemaVersion === historicalFeatureSchemaVersion && modelFeatureRulesVersion === historicalFeatureRulesVersion && modelSourceFeatureDatasetVersion === sourceFeatureDatasetVersion : null;

  return {
    generatedAt: new Date().toISOString(),
    sourceModelValid,
    sourceModelError,
    sourceFeatureDatasetValid,
    sourceFeatureDatasetError,
    versionsAgree,
    modelVersion,
    estimatorType,
    sourceFeatureDatasetVersion,
    featureSchemaVersion: modelFeatureSchemaVersion,
    featureRulesVersion: modelFeatureRulesVersion,
    historicalRowCount,
    readyToBuild: sourceModelValid && sourceFeatureDatasetValid && versionsAgree === true,
  };
}
