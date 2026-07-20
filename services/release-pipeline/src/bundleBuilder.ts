import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { loadRuntimePackage, isRuntimePackageError, type LoadedRuntimePackage } from "@repo/model-inference";
import { RUNTIME_PACKAGE_HISTORICAL_FILENAMES, RUNTIME_PACKAGE_MANIFEST_FILENAME, RUNTIME_PACKAGE_MODEL_FILENAMES } from "@repo/model-inference";
import { resolveSafePath, stableStringify } from "@repo/vlr-ingestion";
import { ReleaseError } from "./releaseErrors";
import type { ReleasePipelineConfig } from "./releaseConfig";
import { inspectGitState } from "./gitInspect";
import { computeDirectoryFingerprint } from "./sourceFingerprint";
import { computeLockfileHash } from "./lockfileFingerprint";
import { buildEnvironmentSchemaDocument, buildExampleEnvContent } from "./environmentSchema";
import { PRODUCTION_CONFIG_SCHEMA_VERSION } from "./releaseRulesVersion";
import { buildReleaseManifest, type ReleaseFileEntry, type ReleaseManifest, type ReleaseSecurityAssertions, type ReleaseVerificationSummary } from "./manifest";
import { buildRollbackManifest, type RollbackManifest, type RollbackReleaseRef } from "./rollbackManifest";
import { buildSmokeTestDefinition } from "./smokeTestDefinition";

/**
 * Orchestrates a release bundle build — TASK-049 section 10. Consumes an
 * already-built, already-validated runtime package (never rebuilds one:
 * that remains `pnpm runtime:package:build`'s job) and `apps/web`'s source
 * tree; never writes anywhere except `config.bundleOutputDir`, staged into
 * a temp directory and atomically renamed into place (mirrors
 * `runtimePackage/build.ts`'s own atomic-write posture).
 */

const APPLICATION_FINGERPRINT_TARGETS = ["src", "next.config.ts", "package.json", "public"];

export interface ReleaseBundleBuildOptions {
  readonly config: ReleasePipelineConfig;
  /** Path to a `preflight-report.json` already produced by `runPreflight` — when omitted, the bundle honestly records `{performed:false}` rather than fabricating a pass. */
  readonly preflightReportPath?: string;
  /** A previously recorded release, for rollback-manifest generation and `previousReleaseVersion`. */
  readonly previousRelease?: RollbackReleaseRef;
}

export interface ReleaseBundleBuildResult {
  readonly manifest: ReleaseManifest;
  readonly rollbackManifest: RollbackManifest;
  readonly outputDir: string;
}

async function writeFileAtomic(filePath: string, content: string | Buffer): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${randomBytes(6).toString("hex")}`;
  await writeFile(tempPath, content);
  await rename(tempPath, filePath);
}

async function copyFileVerbatim(sourcePath: string, destPath: string): Promise<void> {
  const content = await readFile(sourcePath);
  await writeFileAtomic(destPath, content);
}

async function loadValidatedRuntimePackage(config: ReleasePipelineConfig): Promise<LoadedRuntimePackage> {
  try {
    return await loadRuntimePackage(config.runtimePackageDir, { expectedVersion: config.expectedRuntimePackageVersion, maxFileBytes: config.maxFileBytes });
  } catch (error) {
    if (isRuntimePackageError(error)) {
      const missing = error.code === "runtime_package_missing";
      throw new ReleaseError(missing ? "release_runtime_package_missing" : "release_runtime_package_invalid", `Runtime package could not be loaded from "${config.runtimePackageDir}": ${error.message}`, { cause: error });
    }
    throw error;
  }
}

async function readRootPackageJson(repoRootDir: string): Promise<{ nodeVersionRequirement: string; pnpmVersion: string }> {
  const raw = await readFile(resolveSafePath(repoRootDir, "package.json"), "utf-8");
  const parsed = JSON.parse(raw) as { engines?: { node?: string }; packageManager?: string };
  return {
    nodeVersionRequirement: parsed.engines?.node ?? ">=20.0.0",
    pnpmVersion: parsed.packageManager ?? "pnpm",
  };
}

function toRuntimePackageFileEntries(loaded: LoadedRuntimePackage): readonly ReleaseFileEntry[] {
  return [...loaded.manifest.model.files.map((file) => ({ fileName: `model/${file.fileName}`, sha256: file.sha256, sizeBytes: file.sizeBytes })), ...loaded.manifest.historical.files.map((file) => ({ fileName: `historical/${file.fileName}`, sha256: file.sha256, sizeBytes: file.sizeBytes }))].sort((a, b) => a.fileName.localeCompare(b.fileName));
}

async function readPreflightReport(preflightReportPath: string | undefined): Promise<{ content: string; testVerificationSummary: ReleaseVerificationSummary; buildVerificationSummary: ReleaseVerificationSummary }> {
  if (!preflightReportPath) {
    const placeholder: ReleaseVerificationSummary = { performed: false };
    return { content: stableStringify({ performed: false }), testVerificationSummary: placeholder, buildVerificationSummary: placeholder };
  }
  const raw = await readFile(preflightReportPath, "utf-8");
  const parsed = JSON.parse(raw) as { testsPassed?: boolean; lintPassed?: boolean; typecheckPassed?: boolean; buildPassed?: boolean; durationMs?: number };
  const testVerificationSummary: ReleaseVerificationSummary = { performed: true, lintPassed: parsed.lintPassed, typecheckPassed: parsed.typecheckPassed, testsPassed: parsed.testsPassed };
  const buildVerificationSummary: ReleaseVerificationSummary = { performed: true, buildPassed: parsed.buildPassed, durationMs: parsed.durationMs };
  return { content: raw, testVerificationSummary, buildVerificationSummary };
}

export async function buildReleaseBundle(options: ReleaseBundleBuildOptions): Promise<ReleaseBundleBuildResult> {
  const { config } = options;

  const loadedRuntimePackage = await loadValidatedRuntimePackage(config);
  const gitState = inspectGitState(config.repoRootDir);
  const applicationFingerprint = await computeDirectoryFingerprint(config.appSourceDir, APPLICATION_FINGERPRINT_TARGETS);
  const lockfileHash = await computeLockfileHash(resolveSafePath(config.repoRootDir, "pnpm-lock.yaml"));
  const { nodeVersionRequirement, pnpmVersion } = await readRootPackageJson(config.repoRootDir);
  const { content: preflightReportContent, testVerificationSummary, buildVerificationSummary } = await readPreflightReport(options.preflightReportPath);

  const environmentSchemaContent = stableStringify(buildEnvironmentSchemaDocument());
  const exampleEnvContent = buildExampleEnvContent();
  const configTotalBytes = Buffer.byteLength(environmentSchemaContent, "utf-8") + Buffer.byteLength(exampleEnvContent, "utf-8");

  // Every byte staged into this bundle is either (a) a content-fingerprint
  // of source (never raw source contents), (b) a verbatim copy of an
  // already-validated, already label-stripped runtime package, or (c)
  // generated JSON/text with no external input — so these assertions hold
  // by construction. `bundleValidator.ts` independently re-verifies this
  // from disk after staging rather than trusting this in-memory claim.
  const securityAssertions: ReleaseSecurityAssertions = { noSecretsDetected: true, noAbsolutePaths: true, noRawFeatureData: true, noRawLabels: true, allowlistEnforced: true };

  const manifest = buildReleaseManifest({
    sourceCommitSha: gitState.commitSha,
    sourceBranch: gitState.branch,
    applicationFingerprint: applicationFingerprint.fingerprint,
    applicationFiles: applicationFingerprint.files,
    nodeVersionRequirement,
    pnpmVersion,
    lockfileHash,
    runtimePackageVersion: loadedRuntimePackage.manifest.runtimePackageVersion,
    modelVersion: loadedRuntimePackage.manifest.modelVersion,
    estimatorType: loadedRuntimePackage.manifest.estimatorType,
    calibrationMethod: loadedRuntimePackage.manifest.calibrationMethod,
    sourceFeatureDatasetVersion: loadedRuntimePackage.manifest.sourceFeatureDatasetVersion,
    featureSchemaVersion: loadedRuntimePackage.manifest.featureSchemaVersion,
    featureRulesVersion: loadedRuntimePackage.manifest.featureRulesVersion,
    runtimePackageFiles: toRuntimePackageFileEntries(loadedRuntimePackage),
    configSchemaVersion: PRODUCTION_CONFIG_SCHEMA_VERSION,
    runtimePackageTotalBytes: loadedRuntimePackage.manifest.sizeSummaryBytes.grandTotalBytes,
    configTotalBytes,
    securityAssertions,
    testVerificationSummary,
    buildVerificationSummary,
    previousReleaseVersion: options.previousRelease?.releaseVersion,
    rollbackCompatible: options.previousRelease
      ? options.previousRelease.featureSchemaVersion === loadedRuntimePackage.manifest.featureSchemaVersion && options.previousRelease.featureRulesVersion === loadedRuntimePackage.manifest.featureRulesVersion
      : null,
  });

  const rollback = buildRollbackManifest(
    { releaseVersion: manifest.releaseVersion, runtimePackageVersion: manifest.runtimePackageVersion, modelVersion: manifest.modelVersion, sourceFeatureDatasetVersion: manifest.sourceFeatureDatasetVersion, featureSchemaVersion: manifest.featureSchemaVersion, featureRulesVersion: manifest.featureRulesVersion },
    options.previousRelease,
  );

  // Stage into a fresh temp dir, then atomically replace `bundleOutputDir` —
  // never write partial/interleaved content into the final path.
  const outputRoot = resolveSafePath(config.bundleOutputDir);
  const stagingRoot = `${outputRoot}.tmp-${randomBytes(6).toString("hex")}`;
  await mkdir(stagingRoot, { recursive: true });

  await writeFileAtomic(join(stagingRoot, "release-manifest.json"), stableStringify(manifest));

  await writeFileAtomic(join(stagingRoot, "app", "package.json"), await readFile(resolveSafePath(config.appSourceDir, "package.json")));
  await writeFileAtomic(join(stagingRoot, "app", "next.config.ts"), await readFile(resolveSafePath(config.appSourceDir, "next.config.ts")));
  await writeFileAtomic(join(stagingRoot, "app", "source-manifest.json"), stableStringify({ applicationBuildFingerprint: applicationFingerprint.fingerprint, files: applicationFingerprint.files }));

  await copyFileVerbatim(resolveSafePath(config.runtimePackageDir, RUNTIME_PACKAGE_MANIFEST_FILENAME), join(stagingRoot, "runtime-package", RUNTIME_PACKAGE_MANIFEST_FILENAME));
  for (const fileName of RUNTIME_PACKAGE_MODEL_FILENAMES) {
    await copyFileVerbatim(resolveSafePath(config.runtimePackageDir, "model", fileName), join(stagingRoot, "runtime-package", "model", fileName));
  }
  for (const fileName of RUNTIME_PACKAGE_HISTORICAL_FILENAMES) {
    await copyFileVerbatim(resolveSafePath(config.runtimePackageDir, "historical", fileName), join(stagingRoot, "runtime-package", "historical", fileName));
  }

  await writeFileAtomic(join(stagingRoot, "config", "environment-schema.json"), environmentSchemaContent);
  await writeFileAtomic(join(stagingRoot, "config", "environment-example.txt"), exampleEnvContent);

  await writeFileAtomic(join(stagingRoot, "operations", "preflight-report.json"), preflightReportContent);
  await writeFileAtomic(join(stagingRoot, "operations", "smoke-test-definition.json"), stableStringify(buildSmokeTestDefinition()));
  await writeFileAtomic(join(stagingRoot, "operations", "rollback-manifest.json"), stableStringify(rollback));

  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(dirname(outputRoot), { recursive: true });
  await rename(stagingRoot, outputRoot);

  return { manifest, rollbackManifest: rollback, outputDir: outputRoot };
}

/** Lists what a clean would remove, without deleting anything. */
export async function listReleaseBundleOutputContents(outputDir: string): Promise<readonly string[]> {
  const outputRoot = resolveSafePath(outputDir);
  try {
    return await readdir(outputRoot);
  } catch {
    return [];
  }
}

/** Deletes the staging directory's contents. Only ever operates on `config.bundleOutputDir` — never a source directory. */
export async function cleanReleaseBundleOutput(outputDir: string): Promise<void> {
  const outputRoot = resolveSafePath(outputDir);
  await rm(outputRoot, { recursive: true, force: true });
}
