import { readFile, lstat } from "node:fs/promises";
import { join } from "node:path";
import { isRuntimePackageError, loadRuntimePackage } from "@repo/model-inference";
import { resolveSafePath } from "@repo/vlr-ingestion";
import { ReleaseError, toSafeReleaseError, type SafeReleaseErrorJSON } from "./releaseErrors";
import { computeReleaseVersion } from "./releaseVersion";
import { computeDirectoryFingerprint } from "./sourceFingerprint";
import { auditBundleSecurity, type BundleSecurityFinding } from "./security/bundleSecurityAudit";
import type { ReleaseManifest } from "./manifest";

/**
 * Independent, from-disk re-validation of an already-built release bundle
 * — TASK-049 section 11. Never trusts `bundleBuilder.ts`'s in-memory
 * result: everything here is re-read and re-derived from the bundle
 * directory alone, the same posture `runtimePackage/loader.ts` takes
 * toward a runtime package. Reuses `loadRuntimePackage` directly against
 * the bundle's own `runtime-package/` subdirectory rather than
 * reimplementing its hash/version/allowlist checks.
 */

const REQUIRED_FILES = ["release-manifest.json", "app/package.json", "app/next.config.ts", "app/source-manifest.json", "config/environment-schema.json", "config/environment-example.txt", "operations/preflight-report.json", "operations/smoke-test-definition.json", "operations/rollback-manifest.json"];

export interface ReleaseBundleValidationResult {
  readonly valid: boolean;
  readonly manifest?: ReleaseManifest;
  readonly errors: readonly string[];
  readonly securityFindings: readonly BundleSecurityFinding[];
  readonly error?: SafeReleaseErrorJSON;
}

async function assertFileExists(bundleDir: string, relativePath: string, errors: string[]): Promise<void> {
  const absolutePath = resolveSafePath(bundleDir, ...relativePath.split("/"));
  const stat = await lstat(absolutePath).catch(() => null);
  if (!stat) {
    errors.push(`Required file "${relativePath}" is missing.`);
    return;
  }
  if (stat.isSymbolicLink()) {
    errors.push(`Required file "${relativePath}" is a symlink, which is not permitted.`);
    return;
  }
  if (!stat.isFile()) {
    errors.push(`Required path "${relativePath}" is not a regular file.`);
  }
}

export interface ReleaseBundleValidationOptions {
  /** When provided, `applicationFiles`/`applicationBuildFingerprint` are re-verified against the live source tree, not just against the bundle's own internal record. */
  readonly appSourceDir?: string;
}

export async function validateReleaseBundle(bundleDir: string, options: ReleaseBundleValidationOptions = {}): Promise<ReleaseBundleValidationResult> {
  const root = resolveSafePath(bundleDir);
  const rootStat = await lstat(root).catch(() => null);
  if (!rootStat || !rootStat.isDirectory()) {
    const error = new ReleaseError("release_bundle_missing", `The release bundle directory "${bundleDir}" does not exist.`);
    return { valid: false, errors: [error.message], securityFindings: [], error: error.toSafeJSON() };
  }

  const errors: string[] = [];
  for (const relativePath of REQUIRED_FILES) {
    await assertFileExists(root, relativePath, errors);
  }
  if (errors.length > 0) {
    return { valid: false, errors, securityFindings: [], error: new ReleaseError("release_manifest_invalid", "One or more required release bundle files are missing.").toSafeJSON() };
  }

  let manifest: ReleaseManifest;
  try {
    manifest = JSON.parse(await readFile(join(root, "release-manifest.json"), "utf-8")) as ReleaseManifest;
  } catch {
    return { valid: false, errors: ['"release-manifest.json" is not valid JSON.'], securityFindings: [] };
  }

  const recomputedReleaseVersion = computeReleaseVersion({
    sourceCommitSha: manifest.sourceCommitSha,
    runtimePackageVersion: manifest.runtimePackageVersion,
    modelVersion: manifest.modelVersion,
    sourceFeatureDatasetVersion: manifest.sourceFeatureDatasetVersion,
    applicationBuildFingerprint: manifest.applicationBuildFingerprint,
    releaseRulesVersion: manifest.releaseRulesVersion,
    lockfileHash: manifest.lockfileHash,
    configSchemaVersion: manifest.configSchemaVersion,
  });
  if (recomputedReleaseVersion !== manifest.releaseVersion) {
    errors.push(`Recomputed releaseVersion "${recomputedReleaseVersion}" does not match the manifest's declared version "${manifest.releaseVersion}".`);
  }

  let sourceManifest: { applicationBuildFingerprint?: string; files?: unknown };
  try {
    sourceManifest = JSON.parse(await readFile(join(root, "app", "source-manifest.json"), "utf-8"));
  } catch {
    sourceManifest = {};
    errors.push('"app/source-manifest.json" is not valid JSON.');
  }
  if (sourceManifest.applicationBuildFingerprint !== manifest.applicationBuildFingerprint) {
    errors.push('"app/source-manifest.json"\'s applicationBuildFingerprint does not match release-manifest.json.');
  }
  if (JSON.stringify(sourceManifest.files) !== JSON.stringify(manifest.applicationFiles.map((file) => ({ path: file.fileName, sha256: file.sha256, sizeBytes: file.sizeBytes })))) {
    errors.push('"app/source-manifest.json"\'s file list does not match release-manifest.json\'s applicationFiles.');
  }

  if (options.appSourceDir) {
    const liveFingerprint = await computeDirectoryFingerprint(options.appSourceDir, ["src", "next.config.ts", "package.json", "public"]);
    if (liveFingerprint.fingerprint !== manifest.applicationBuildFingerprint) {
      errors.push(`Live application source fingerprint "${liveFingerprint.fingerprint}" does not match the bundle's recorded applicationBuildFingerprint "${manifest.applicationBuildFingerprint}" — the source tree has changed since this bundle was built.`);
    }
  }

  try {
    const loadedRuntimePackage = await loadRuntimePackage(join(root, "runtime-package"));
    if (loadedRuntimePackage.manifest.runtimePackageVersion !== manifest.runtimePackageVersion) {
      errors.push(`Bundled runtime package version "${loadedRuntimePackage.manifest.runtimePackageVersion}" does not match release-manifest.json's declared runtimePackageVersion "${manifest.runtimePackageVersion}".`);
    }
  } catch (error) {
    errors.push(`Bundled runtime package failed its own integrity check: ${isRuntimePackageError(error) ? error.message : "unknown error"}.`);
  }

  let environmentSchema: { configSchemaVersion?: string };
  try {
    environmentSchema = JSON.parse(await readFile(join(root, "config", "environment-schema.json"), "utf-8"));
  } catch {
    environmentSchema = {};
    errors.push('"config/environment-schema.json" is not valid JSON.');
  }
  if (environmentSchema.configSchemaVersion !== manifest.configSchemaVersion) {
    errors.push('"config/environment-schema.json"\'s configSchemaVersion does not match release-manifest.json.');
  }

  const securityFindings = await auditBundleSecurity(root);
  for (const finding of securityFindings) {
    errors.push(`Security finding [${finding.code}] at "${finding.path}": ${finding.reason}`);
  }

  const valid = errors.length === 0;
  return { valid, manifest, errors, securityFindings, ...(valid ? {} : { error: toSafeReleaseError(new ReleaseError("release_hash_mismatch", "Release bundle failed validation.")) }) };
}
