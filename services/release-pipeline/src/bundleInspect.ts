import { readFile, lstat, readdir } from "node:fs/promises";
import { resolveSafePath } from "@repo/vlr-ingestion";
import type { ReleaseManifest } from "./manifest";

/**
 * Safe, human-readable summaries for `release:bundle:status` /
 * `release:bundle:inspect` — TASK-049 section 12. Never prints a resolved
 * absolute path, an environment value, or raw model/feature content; only
 * the manifest's own already-safe fields.
 */

export interface ReleaseBundleStatus {
  readonly exists: boolean;
  readonly releaseVersion?: string;
  readonly generatedAt?: string;
  readonly runtimePackageVersion?: string;
  readonly modelVersion?: string;
  readonly sourceCommitSha?: string;
}

export async function getReleaseBundleStatus(bundleDir: string): Promise<ReleaseBundleStatus> {
  const manifestPath = resolveSafePath(bundleDir, "release-manifest.json");
  const stat = await lstat(manifestPath).catch(() => null);
  if (!stat || !stat.isFile()) return { exists: false };
  const manifest = JSON.parse(await readFile(manifestPath, "utf-8")) as ReleaseManifest;
  return {
    exists: true,
    releaseVersion: manifest.releaseVersion,
    generatedAt: manifest.generatedAt,
    runtimePackageVersion: manifest.runtimePackageVersion,
    modelVersion: manifest.modelVersion,
    sourceCommitSha: manifest.sourceCommitSha,
  };
}

export interface ReleaseBundleInspection extends ReleaseBundleStatus {
  readonly applicationFileCount?: number;
  readonly runtimePackageFileCount?: number;
  readonly sizeSummaryBytes?: ReleaseManifest["sizeSummaryBytes"];
  readonly supportedRuntimeTargets?: readonly string[];
  readonly conditionalRuntimeTargets?: readonly string[];
  readonly unsupportedRuntimeTargets?: readonly string[];
  readonly securityAssertions?: ReleaseManifest["securityAssertions"];
}

export async function inspectReleaseBundle(bundleDir: string): Promise<ReleaseBundleInspection> {
  const manifestPath = resolveSafePath(bundleDir, "release-manifest.json");
  const stat = await lstat(manifestPath).catch(() => null);
  if (!stat || !stat.isFile()) return { exists: false };
  const manifest = JSON.parse(await readFile(manifestPath, "utf-8")) as ReleaseManifest;
  return {
    exists: true,
    releaseVersion: manifest.releaseVersion,
    generatedAt: manifest.generatedAt,
    runtimePackageVersion: manifest.runtimePackageVersion,
    modelVersion: manifest.modelVersion,
    sourceCommitSha: manifest.sourceCommitSha,
    applicationFileCount: manifest.applicationFiles.length,
    runtimePackageFileCount: manifest.runtimePackageFiles.length,
    sizeSummaryBytes: manifest.sizeSummaryBytes,
    supportedRuntimeTargets: manifest.supportedRuntimeTargets,
    conditionalRuntimeTargets: manifest.conditionalRuntimeTargets,
    unsupportedRuntimeTargets: manifest.unsupportedRuntimeTargets,
    securityAssertions: manifest.securityAssertions,
  };
}

/** Present regardless of `--dry-run`: whether `bundleDir/operations` and the root manifest exist, used by `bundleClean` to require an explicit non-dry-run flag before deleting anything. */
export async function describeCleanTarget(bundleDir: string): Promise<{ readonly exists: boolean; readonly entryCount: number; readonly entries: readonly string[] }> {
  const root = resolveSafePath(bundleDir);
  const stat = await lstat(root).catch(() => null);
  if (!stat || !stat.isDirectory()) return { exists: false, entryCount: 0, entries: [] };
  const entries = await readdir(root);
  return { exists: true, entryCount: entries.length, entries };
}
