import { readFile, readdir, lstat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, relative, sep } from "node:path";
import { resolveSafePath } from "@repo/vlr-ingestion";
import { ReleaseError } from "./releaseErrors";

/**
 * Deterministic content-fingerprint of a set of source files/directories —
 * the basis of `applicationBuildFingerprint`. Deliberately hashes raw file
 * bytes rather than relying on Next.js's own `BUILD_ID` (which Next
 * generates randomly per build unless `generateBuildId` is set), since a
 * random component would break `computeReleaseVersion`'s idempotency
 * requirement (same source → same release twice in a row). Symlinks are
 * rejected outright rather than followed, matching the runtime package
 * loader's own safety posture.
 */

const EXCLUDED_DIR_NAMES = new Set(["node_modules", ".next", ".turbo", ".git", "coverage", "test-results", "playwright-report", "blob-report", ".cache"]);

export interface FingerprintFileEntry {
  readonly path: string;
  readonly sha256: string;
  readonly sizeBytes: number;
}

export interface DirectoryFingerprint {
  readonly files: readonly FingerprintFileEntry[];
  readonly fingerprint: string;
}

function sha256Hex(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function toPosixRelative(root: string, absolutePath: string): string {
  return relative(root, absolutePath).split(sep).join("/");
}

async function walkFile(root: string, absolutePath: string, out: FingerprintFileEntry[]): Promise<void> {
  const content = await readFile(absolutePath);
  const stat = await lstat(absolutePath);
  out.push({ path: toPosixRelative(root, absolutePath), sha256: sha256Hex(content), sizeBytes: stat.size });
}

async function walkDirectory(root: string, dirPath: string, out: FingerprintFileEntry[]): Promise<void> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
    if (EXCLUDED_DIR_NAMES.has(entry.name)) continue;
    const absolutePath = join(dirPath, entry.name);
    const entryStat = await lstat(absolutePath);
    if (entryStat.isSymbolicLink()) {
      throw new ReleaseError("release_symlink_rejected", `Symlink encountered while fingerprinting source: "${toPosixRelative(root, absolutePath)}".`, { details: { path: toPosixRelative(root, absolutePath) } });
    }
    if (entryStat.isDirectory()) {
      await walkDirectory(root, absolutePath, out);
    } else if (entryStat.isFile()) {
      await walkFile(root, absolutePath, out);
    }
  }
}

/**
 * `rootDir`: the directory every fingerprinted path is expressed relative
 * to (and the base every `resolveSafePath` call is checked against).
 * `relativeTargets`: a mix of file and directory paths relative to
 * `rootDir` (e.g. `["src", "next.config.ts", "package.json"]`). Missing
 * targets are silently skipped (not every target is guaranteed to exist in
 * a fixture app directory).
 */
export async function computeDirectoryFingerprint(rootDir: string, relativeTargets: readonly string[]): Promise<DirectoryFingerprint> {
  const root = resolveSafePath(rootDir);
  const files: FingerprintFileEntry[] = [];

  for (const target of relativeTargets) {
    const absolutePath = resolveSafePath(root, target);
    const targetStat = await lstat(absolutePath).catch(() => null);
    if (!targetStat) continue;
    if (targetStat.isSymbolicLink()) {
      throw new ReleaseError("release_symlink_rejected", `Symlink encountered while fingerprinting source: "${target}".`, { details: { path: target } });
    }
    if (targetStat.isDirectory()) {
      await walkDirectory(root, absolutePath, files);
    } else if (targetStat.isFile()) {
      await walkFile(root, absolutePath, files);
    }
  }

  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));
  const canonical = JSON.stringify(sortedFiles.map((file) => [file.path, file.sha256, file.sizeBytes]));
  const fingerprint = createHash("sha256").update(canonical).digest("hex").slice(0, 16);

  return { files: sortedFiles, fingerprint };
}
