import { mkdir, readdir, rm, rename, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { dirname } from "node:path";
import { contentHashOf, resolveSafePath, stableStringify } from "@repo/vlr-ingestion";
import { exportModelArtifact } from "./modelExport";
import { buildHistoricalExport } from "./historicalExport";
import { computeRuntimePackageVersion } from "./runtimePackageVersion";
import { RuntimePackageError } from "./runtimePackageErrors";
import { RUNTIME_PACKAGE_HISTORICAL_FILENAMES, RUNTIME_PACKAGE_MANIFEST_FILENAME, RUNTIME_PACKAGE_MODEL_FILENAMES } from "./runtimePackageTypes";
import type { RuntimePackageFileEntry, RuntimePackageManifest } from "./runtimePackageTypes";
import type { RuntimePackageBuildConfig } from "./config";

/**
 * Builds a runtime package into `config.outputDir` from the currently
 * selected model artifact + the currently generated feature dataset —
 * TASK-048. Read-only against both source directories; every write goes
 * through `resolveSafePath(config.outputDir, ...)`, so this function can
 * never write outside its own staging directory. Deterministic and
 * idempotent: rebuilding from unchanged source data reproduces the same
 * `runtimePackageVersion` and the same per-file hashes (only `generatedAt`
 * differs) — see `runtimePackageVersion.ts`.
 */

const MINIMUM_RUNTIME_NODE_VERSION = "20.0.0";
const SUPPORTED_RUNTIME_TARGETS = ["node-server", "standalone-container"] as const;
const CONDITIONAL_RUNTIME_TARGETS = ["serverless"] as const;
const UNSUPPORTED_RUNTIME_TARGETS = ["edge"] as const;

export interface BuildRuntimePackageResult {
  readonly manifest: RuntimePackageManifest;
  readonly outputDir: string;
}

async function writeFileAtomic(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${randomBytes(6).toString("hex")}`;
  await writeFile(tempPath, content, "utf-8");
  await rename(tempPath, filePath);
}

function byteLength(content: string): number {
  return Buffer.byteLength(content, "utf-8");
}

export async function buildRuntimePackage(config: RuntimePackageBuildConfig): Promise<BuildRuntimePackageResult> {
  const modelExport = await exportModelArtifact(config.sourceModelDir, config.maxFileBytes);
  const historicalExport = await buildHistoricalExport(config.sourceFeatureDataDir, {
    requiredInputFields: modelExport.featureContract.requiredInputFields,
    nullableNumericFields: modelExport.featureContract.nullableNumericFields,
  });

  // The model's own declared training-dataset version must agree with the
  // feature dataset actually being packaged for historical replay —
  // otherwise the packaged rows would not correspond to what the model was
  // trained against, which is exactly the kind of "feature dataset drift"
  // TASK-047's adapter already guards against at request time (see
  // `predictionAdapter.ts`'s comment on sending the row's *own* recorded
  // version). Packaging must not silently produce an internally
  // inconsistent package.
  if (modelExport.manifest.sourceFeatureDatasetVersion !== historicalExport.manifest.sourceFeatureDatasetVersion) {
    throw new RuntimePackageError(
      "runtime_package_build_failed",
      `Model's declared sourceFeatureDatasetVersion "${modelExport.manifest.sourceFeatureDatasetVersion}" does not match the source feature dataset's own version "${historicalExport.manifest.sourceFeatureDatasetVersion}". Retrain or re-export before packaging.`,
    );
  }

  // Serialize the 3 historical files up front so their hashes/sizes reflect
  // exactly the bytes about to be written (same convention as the model
  // export's per-file hashes: a content hash of the *parsed* canonical
  // value, not raw bytes, so hash agreement survives incidental whitespace
  // differences).
  const historicalIndexContent = stableStringify(historicalExport.index);
  const historicalRowsContent = stableStringify(historicalExport.rows);
  const historicalManifestContent = stableStringify(historicalExport.manifest);

  const historicalFiles: RuntimePackageFileEntry[] = [
    { fileName: "historical-index.json", sha256: contentHashOf(historicalExport.index), sizeBytes: byteLength(historicalIndexContent) },
    { fileName: "historical-rows.json", sha256: contentHashOf(historicalExport.rows), sizeBytes: byteLength(historicalRowsContent) },
    { fileName: "historical-manifest.json", sha256: contentHashOf(historicalExport.manifest), sizeBytes: byteLength(historicalManifestContent) },
  ];

  const runtimePackageVersion = computeRuntimePackageVersion({
    modelVersion: modelExport.manifest.modelVersion,
    sourceFeatureDatasetVersion: historicalExport.manifest.sourceFeatureDatasetVersion,
    featureSchemaVersion: historicalExport.manifest.featureSchemaVersion,
    featureRulesVersion: historicalExport.manifest.featureRulesVersion,
    modelFiles: modelExport.files,
    historicalFiles,
    historicalRowCount: historicalExport.manifest.rowCount,
    historicalCatalogCount: historicalExport.manifest.catalogCount,
  });

  const modelTotalBytes = modelExport.files.reduce((sum, file) => sum + file.sizeBytes, 0);
  const historicalTotalBytes = historicalFiles.reduce((sum, file) => sum + file.sizeBytes, 0);

  const manifest: RuntimePackageManifest = {
    packageRulesVersion: "runtime-package-rules@1.0.0",
    runtimePackageVersion,
    generatedAt: new Date().toISOString(),
    modelVersion: modelExport.manifest.modelVersion,
    estimatorType: modelExport.manifest.estimatorType,
    calibrationMethod: modelExport.manifest.calibrationMethod,
    sourceFeatureDatasetVersion: historicalExport.manifest.sourceFeatureDatasetVersion,
    featureSchemaVersion: historicalExport.manifest.featureSchemaVersion,
    featureRulesVersion: historicalExport.manifest.featureRulesVersion,
    model: { files: [...modelExport.files].sort((a, b) => a.fileName.localeCompare(b.fileName)) },
    historical: { files: [...historicalFiles].sort((a, b) => a.fileName.localeCompare(b.fileName)), rowCount: historicalExport.manifest.rowCount, catalogCount: historicalExport.manifest.catalogCount },
    minimumRuntimeNodeVersion: MINIMUM_RUNTIME_NODE_VERSION,
    runtimeTargets: { supported: [...SUPPORTED_RUNTIME_TARGETS], conditional: [...CONDITIONAL_RUNTIME_TARGETS], unsupported: [...UNSUPPORTED_RUNTIME_TARGETS] },
    sizeSummaryBytes: {
      modelTotalBytes,
      historicalTotalBytes,
      manifestBytes: 0, // filled in after the manifest itself is serialized, below
      grandTotalBytes: 0,
    },
  };

  const manifestContentDraft = stableStringify(manifest);
  const manifestBytes = byteLength(manifestContentDraft);
  const finalManifest: RuntimePackageManifest = {
    ...manifest,
    sizeSummaryBytes: { modelTotalBytes, historicalTotalBytes, manifestBytes, grandTotalBytes: modelTotalBytes + historicalTotalBytes + manifestBytes },
  };
  const manifestContent = stableStringify(finalManifest);

  // Clear any prior build's contents first — never touches anything outside `config.outputDir`.
  const outputRoot = resolveSafePath(config.outputDir);
  await mkdir(outputRoot, { recursive: true });
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });

  await writeFileAtomic(resolveSafePath(outputRoot, RUNTIME_PACKAGE_MANIFEST_FILENAME), manifestContent);

  const modelFileContents: Record<string, unknown> = {
    "model.json": modelExport.model,
    "preprocessing.json": modelExport.preprocessing,
    "calibration.json": modelExport.calibration,
    "feature-contract.json": modelExport.featureContract,
    "model-manifest.json": modelExport.manifest,
  };
  for (const fileName of RUNTIME_PACKAGE_MODEL_FILENAMES) {
    await writeFileAtomic(resolveSafePath(outputRoot, "model", fileName), stableStringify(modelFileContents[fileName]));
  }

  const historicalFileContents: Record<string, string> = {
    "historical-index.json": historicalIndexContent,
    "historical-rows.json": historicalRowsContent,
    "historical-manifest.json": historicalManifestContent,
  };
  for (const fileName of RUNTIME_PACKAGE_HISTORICAL_FILENAMES) {
    await writeFileAtomic(resolveSafePath(outputRoot, "historical", fileName), historicalFileContents[fileName]);
  }

  return { manifest: finalManifest, outputDir: outputRoot };
}

/** Lists what a clean would remove, without deleting anything. */
export async function listRuntimePackageOutputContents(outputDir: string): Promise<readonly string[]> {
  const outputRoot = resolveSafePath(outputDir);
  try {
    return await readdir(outputRoot);
  } catch {
    return [];
  }
}

/** Deletes the staging directory's contents. Only ever operates on `config.outputDir` — never a source directory. */
export async function cleanRuntimePackageOutput(outputDir: string): Promise<void> {
  const outputRoot = resolveSafePath(outputDir);
  await rm(outputRoot, { recursive: true, force: true });
}
