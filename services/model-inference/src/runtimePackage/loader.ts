import { lstat, readFile, readdir } from "node:fs/promises";
import { contentHashOf, resolveSafePath } from "@repo/vlr-ingestion";
import { RuntimePackageError } from "./runtimePackageErrors";
import { computeRuntimePackageVersion } from "./runtimePackageVersion";
import { RUNTIME_PACKAGE_HISTORICAL_FILENAMES, RUNTIME_PACKAGE_MANIFEST_FILENAME, RUNTIME_PACKAGE_MODEL_FILENAMES } from "./runtimePackageTypes";
import type { RuntimeHistoricalIndexEntry, RuntimeHistoricalManifest, RuntimeHistoricalRow, RuntimePackageManifest } from "./runtimePackageTypes";

/**
 * Runtime package loader — TASK-048. The single place any consumer (the
 * packaging CLI's own `validate`/`smoke` commands, and `apps/web`'s
 * `runtimePackageSource.ts`) reads an already-built runtime package from
 * disk. Enforces every safety invariant in one place: safe path resolution,
 * a fixed filename allowlist, symlink rejection, per-file size limits,
 * `JSON.parse`-only parsing (never `eval`/dynamic `import`), a
 * prototype-pollution guard on every parsed value, full content-hash
 * verification against `manifest.json`, and cross-file version agreement.
 * Returns an immutable (`Object.freeze`d), in-memory snapshot — nothing
 * here re-reads disk after a successful load.
 */

const MAX_MANIFEST_BYTES = 5_000_000;

export interface LoadedRuntimePackage {
  readonly manifest: RuntimePackageManifest;
  /** Absolute, resolved path to `<packageDir>/model` — safe to pass directly to `LocalFilesystemArtifactSource`. */
  readonly modelDir: string;
  readonly historicalIndex: readonly RuntimeHistoricalIndexEntry[];
  readonly historicalRows: readonly RuntimeHistoricalRow[];
  readonly historicalRowsById: ReadonlyMap<string, RuntimeHistoricalRow>;
  readonly historicalManifest: RuntimeHistoricalManifest;
}

export interface LoadRuntimePackageOptions {
  readonly expectedVersion?: string;
  readonly maxFileBytes?: number;
}

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** Rejects any parsed JSON value containing a literal `__proto__`/`constructor`/`prototype` own-key anywhere in its structure — defense-in-depth against prototype pollution in downstream code that might copy these keys. */
function assertNoForbiddenKeys(value: unknown, fileName: string): void {
  if (Array.isArray(value)) {
    for (const entry of value) assertNoForbiddenKeys(entry, fileName);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const key of Object.getOwnPropertyNames(value)) {
      if (FORBIDDEN_KEYS.has(key)) {
        throw new RuntimePackageError("runtime_package_manifest_invalid", `File "${fileName}" contains a forbidden key "${key}".`, { details: { fileName, key } });
      }
      assertNoForbiddenKeys((value as Record<string, unknown>)[key], fileName);
    }
  }
}

async function readAllowlistedJsonFile<T>(root: string, maxBytes: number, ...segments: string[]): Promise<T> {
  const relPath = segments.join("/");
  const filePath = resolveSafePath(root, ...segments);
  const linkStat = await lstat(filePath).catch(() => null);
  if (!linkStat) {
    throw new RuntimePackageError("runtime_package_manifest_invalid", `Runtime package file "${relPath}" was not found.`, { details: { path: relPath } });
  }
  if (!linkStat.isFile()) {
    throw new RuntimePackageError("runtime_package_unsafe_path", `Runtime package path "${relPath}" is not a regular file (symlinks are rejected).`, { details: { path: relPath } });
  }
  if (linkStat.size > maxBytes) {
    throw new RuntimePackageError("runtime_package_unsafe_path", `Runtime package file "${relPath}" (${linkStat.size} bytes) exceeds the configured size limit of ${maxBytes} bytes.`, { details: { path: relPath, sizeBytes: linkStat.size, maxBytes } });
  }
  const raw = await readFile(filePath, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new RuntimePackageError("runtime_package_manifest_invalid", `Runtime package file "${relPath}" is not valid JSON.`, { details: { path: relPath } });
  }
  assertNoForbiddenKeys(parsed, relPath);
  return parsed as T;
}

/** Rejects unexpected files/directories under `<root>/<subdir>` — every present entry must be exactly one of `allowlist`. */
async function assertOnlyAllowlistedEntries(root: string, subdir: string, allowlist: readonly string[]): Promise<void> {
  const dirPath = resolveSafePath(root, subdir);
  const dirStat = await lstat(dirPath).catch(() => null);
  if (!dirStat) {
    throw new RuntimePackageError("runtime_package_manifest_invalid", `Runtime package directory "${subdir}" was not found.`, { details: { path: subdir } });
  }
  if (!dirStat.isDirectory()) {
    throw new RuntimePackageError("runtime_package_unsafe_path", `Runtime package path "${subdir}" is not a regular directory (symlinks are rejected).`, { details: { path: subdir } });
  }
  const entries = await readdir(dirPath);
  const allowlistSet = new Set(allowlist);
  for (const entry of entries) {
    if (!allowlistSet.has(entry)) {
      throw new RuntimePackageError("runtime_package_manifest_invalid", `Runtime package directory "${subdir}" contains an unexpected file "${entry}".`, { details: { path: `${subdir}/${entry}` } });
    }
  }
}

function assertManifestShape(manifest: unknown, fileName: string): asserts manifest is RuntimePackageManifest {
  if (manifest === null || typeof manifest !== "object") {
    throw new RuntimePackageError("runtime_package_manifest_invalid", `File "${fileName}" is not a JSON object.`);
  }
  const requiredStringFields = ["packageRulesVersion", "runtimePackageVersion", "generatedAt", "modelVersion", "estimatorType", "calibrationMethod", "sourceFeatureDatasetVersion", "featureSchemaVersion", "featureRulesVersion", "minimumRuntimeNodeVersion"];
  const record = manifest as Record<string, unknown>;
  for (const field of requiredStringFields) {
    if (typeof record[field] !== "string" || (record[field] as string).length === 0) {
      throw new RuntimePackageError("runtime_package_manifest_invalid", `File "${fileName}" is missing required string field "${field}".`, { details: { fileName, field } });
    }
  }
  const model = record.model as Record<string, unknown> | undefined;
  const historical = record.historical as Record<string, unknown> | undefined;
  if (!model || !Array.isArray(model.files) || !historical || !Array.isArray(historical.files) || typeof historical.rowCount !== "number" || typeof historical.catalogCount !== "number") {
    throw new RuntimePackageError("runtime_package_manifest_invalid", `File "${fileName}" is missing required "model"/"historical" file-list fields.`, { details: { fileName } });
  }
}

function fileEntryHash(manifestFiles: readonly { fileName: string; sha256: string }[], fileName: string): string {
  const entry = manifestFiles.find((file) => file.fileName === fileName);
  if (!entry) {
    throw new RuntimePackageError("runtime_package_manifest_invalid", `Manifest does not declare an entry for "${fileName}".`, { details: { fileName } });
  }
  return entry.sha256;
}

function assertHashMatches(fileName: string, expected: string, parsed: unknown): void {
  const actual = contentHashOf(parsed);
  if (actual !== expected) {
    throw new RuntimePackageError("runtime_package_hash_mismatch", `Content hash mismatch for "${fileName}": expected "${expected}", computed "${actual}".`, { details: { fileName, expected, actual } });
  }
}

export async function loadRuntimePackage(dir: string, options: LoadRuntimePackageOptions = {}): Promise<LoadedRuntimePackage> {
  const maxFileBytes = options.maxFileBytes ?? 50_000_000;
  const root = resolveSafePath(dir);

  const rootStat = await lstat(root).catch(() => null);
  if (!rootStat) {
    throw new RuntimePackageError("runtime_package_missing", "The runtime package directory does not exist. Run `pnpm runtime:package:build` to create one.", { details: { path: "." } });
  }
  if (!rootStat.isDirectory()) {
    throw new RuntimePackageError("runtime_package_unsafe_path", "The configured runtime package path is not a directory (symlinks are rejected).");
  }

  const manifestRaw = await readAllowlistedJsonFile<unknown>(root, MAX_MANIFEST_BYTES, RUNTIME_PACKAGE_MANIFEST_FILENAME);
  assertManifestShape(manifestRaw, RUNTIME_PACKAGE_MANIFEST_FILENAME);
  const manifest = manifestRaw;

  await assertOnlyAllowlistedEntries(root, "model", RUNTIME_PACKAGE_MODEL_FILENAMES);
  await assertOnlyAllowlistedEntries(root, "historical", RUNTIME_PACKAGE_HISTORICAL_FILENAMES);

  const modelJson = await readAllowlistedJsonFile<{ estimatorType: string }>(root, maxFileBytes, "model", "model.json");
  assertHashMatches("model.json", fileEntryHash(manifest.model.files, "model.json"), modelJson);
  const preprocessingJson = await readAllowlistedJsonFile<unknown>(root, maxFileBytes, "model", "preprocessing.json");
  assertHashMatches("preprocessing.json", fileEntryHash(manifest.model.files, "preprocessing.json"), preprocessingJson);
  const calibrationJson = await readAllowlistedJsonFile<{ method: string }>(root, maxFileBytes, "model", "calibration.json");
  assertHashMatches("calibration.json", fileEntryHash(manifest.model.files, "calibration.json"), calibrationJson);
  const featureContractJson = await readAllowlistedJsonFile<{ featureSchemaVersion: string; featureRulesVersion: string; requiredInputFields: readonly string[] }>(root, maxFileBytes, "model", "feature-contract.json");
  assertHashMatches("feature-contract.json", fileEntryHash(manifest.model.files, "feature-contract.json"), featureContractJson);
  const modelManifestJson = await readAllowlistedJsonFile<{ modelVersion: string; featureSchemaVersion: string; featureRulesVersion: string }>(root, maxFileBytes, "model", "model-manifest.json");
  assertHashMatches("model-manifest.json", fileEntryHash(manifest.model.files, "model-manifest.json"), modelManifestJson);

  if (modelManifestJson.modelVersion !== manifest.modelVersion) {
    throw new RuntimePackageError("runtime_package_model_mismatch", `Model artifact's own modelVersion "${modelManifestJson.modelVersion}" does not match the package manifest's modelVersion "${manifest.modelVersion}".`);
  }
  if (featureContractJson.featureSchemaVersion !== manifest.featureSchemaVersion || featureContractJson.featureRulesVersion !== manifest.featureRulesVersion) {
    throw new RuntimePackageError("runtime_package_feature_mismatch", "The model artifact's feature-contract schema/rules version does not match the package manifest.");
  }

  const historicalIndex = await readAllowlistedJsonFile<RuntimeHistoricalIndexEntry[]>(root, maxFileBytes, "historical", "historical-index.json");
  assertHashMatches("historical-index.json", fileEntryHash(manifest.historical.files, "historical-index.json"), historicalIndex);
  const historicalRows = await readAllowlistedJsonFile<RuntimeHistoricalRow[]>(root, maxFileBytes, "historical", "historical-rows.json");
  assertHashMatches("historical-rows.json", fileEntryHash(manifest.historical.files, "historical-rows.json"), historicalRows);
  const historicalManifest = await readAllowlistedJsonFile<RuntimeHistoricalManifest>(root, maxFileBytes, "historical", "historical-manifest.json");
  assertHashMatches("historical-manifest.json", fileEntryHash(manifest.historical.files, "historical-manifest.json"), historicalManifest);

  if (historicalManifest.sourceFeatureDatasetVersion !== manifest.sourceFeatureDatasetVersion || historicalManifest.featureSchemaVersion !== manifest.featureSchemaVersion || historicalManifest.featureRulesVersion !== manifest.featureRulesVersion) {
    throw new RuntimePackageError("runtime_package_feature_mismatch", "The historical dataset's version fields do not match the package manifest.");
  }

  if (historicalRows.length !== manifest.historical.rowCount || historicalManifest.rowCount !== manifest.historical.rowCount) {
    throw new RuntimePackageError("runtime_package_row_count_mismatch", `Historical row count mismatch: manifest declares ${manifest.historical.rowCount}, found ${historicalRows.length}.`, { details: { declared: manifest.historical.rowCount, actual: historicalRows.length } });
  }
  if (historicalIndex.length !== manifest.historical.catalogCount || historicalManifest.catalogCount !== manifest.historical.catalogCount) {
    throw new RuntimePackageError("runtime_package_row_count_mismatch", `Historical catalog count mismatch: manifest declares ${manifest.historical.catalogCount}, found ${historicalIndex.length}.`, { details: { declared: manifest.historical.catalogCount, actual: historicalIndex.length } });
  }

  const historicalRowsById = new Map<string, RuntimeHistoricalRow>();
  for (const row of historicalRows) {
    if (typeof row.matchInternalId !== "string" || row.matchInternalId.length === 0) {
      throw new RuntimePackageError("runtime_package_row_count_mismatch", "A historical row is missing a valid matchInternalId.");
    }
    if (historicalRowsById.has(row.matchInternalId)) {
      throw new RuntimePackageError("runtime_package_row_count_mismatch", `Duplicate matchInternalId "${row.matchInternalId}" found in the historical dataset.`, { details: { matchInternalId: row.matchInternalId } });
    }
    historicalRowsById.set(row.matchInternalId, row);
  }

  const recomputedVersion = computeRuntimePackageVersion({
    modelVersion: manifest.modelVersion,
    sourceFeatureDatasetVersion: manifest.sourceFeatureDatasetVersion,
    featureSchemaVersion: manifest.featureSchemaVersion,
    featureRulesVersion: manifest.featureRulesVersion,
    modelFiles: manifest.model.files,
    historicalFiles: manifest.historical.files,
    historicalRowCount: manifest.historical.rowCount,
    historicalCatalogCount: manifest.historical.catalogCount,
  });
  if (recomputedVersion !== manifest.runtimePackageVersion) {
    throw new RuntimePackageError("runtime_package_hash_mismatch", `Recomputed runtimePackageVersion "${recomputedVersion}" does not match the manifest's declared version "${manifest.runtimePackageVersion}".`);
  }
  if (options.expectedVersion && options.expectedVersion !== manifest.runtimePackageVersion) {
    throw new RuntimePackageError("runtime_package_version_mismatch", `Runtime package version "${manifest.runtimePackageVersion}" does not match the configured expected version "${options.expectedVersion}".`, { details: { loaded: manifest.runtimePackageVersion, expected: options.expectedVersion } });
  }

  return Object.freeze({
    manifest,
    modelDir: resolveSafePath(root, "model"),
    historicalIndex: Object.freeze(historicalIndex),
    historicalRows: Object.freeze(historicalRows),
    historicalRowsById,
    historicalManifest,
  });
}
