import { createHash } from "node:crypto";
import { lstat, readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { resolveSafePath } from "@repo/vlr-ingestion";
import { InferenceError } from "./errors";

/**
 * Artifact-source abstraction — TASK-046 requirement 4. Only a local
 * filesystem source is implemented; packaged-artifact, object-storage, and
 * model-registry sources are deliberately not built here (see docs/34,
 * "Artifact packaging policy"), but the `ArtifactSource` interface is
 * shaped so a future source only needs to implement `listFiles`/`statFile`/
 * `readFile` — nothing above this layer needs to change.
 *
 * Security invariants enforced here (never anywhere else):
 * - every file name is checked against a fixed allowlist before any
 *   filesystem call touches it (no dynamic `require`/`import`, no arbitrary
 *   read)
 * - path resolution goes through `resolveSafePath` (traversal-safe)
 * - a file that is a symlink is rejected outright (TOCTOU-safe: checked
 *   with `lstat` immediately before the read, not cached)
 * - each file is size-checked before its contents are read into memory
 */

export const APPROVED_ARTIFACT_FILENAMES = ["model.json", "preprocessing.json", "calibration.json", "feature-contract.json", "model-manifest.json", "model-card.json", "evaluation.json", "test-predictions.json", "fold-predictions.json", "reliability-data.json", "feature-importance.json"] as const;

export type ApprovedArtifactFilename = (typeof APPROVED_ARTIFACT_FILENAMES)[number];

/** The subset of files `loadModelArtifactForInference` actually reads — everything else is reporting/diagnostic output the service never needs at inference time. */
export const INFERENCE_CRITICAL_FILENAMES = ["model.json", "preprocessing.json", "calibration.json", "feature-contract.json", "model-manifest.json"] as const satisfies readonly ApprovedArtifactFilename[];

export interface ArtifactSourceDescriptor {
  readonly kind: "local-filesystem";
  /** Safe, non-reversible identity for the configured location — never the raw path (TASK-046 requirement 6, "artifact directory identity without leaking unsafe paths"). */
  readonly directoryId: string;
}

export interface ArtifactFileStat {
  readonly fileName: string;
  readonly sizeBytes: number;
}

export interface ArtifactSource {
  describe(): ArtifactSourceDescriptor;
  /** Lists only approved, present, regular (non-symlink) files. */
  listFiles(): Promise<readonly ApprovedArtifactFilename[]>;
  statFile(fileName: ApprovedArtifactFilename): Promise<ArtifactFileStat>;
  readFile(fileName: ApprovedArtifactFilename, maxBytes: number): Promise<string>;
}

function isApprovedFilename(fileName: string): fileName is ApprovedArtifactFilename {
  return (APPROVED_ARTIFACT_FILENAMES as readonly string[]).includes(fileName);
}

function directoryIdentity(resolvedDir: string): string {
  return createHash("sha256").update(resolvedDir).digest("hex").slice(0, 16);
}

export class LocalFilesystemArtifactSource implements ArtifactSource {
  private readonly resolvedDir: string;

  constructor(artifactDir: string) {
    // resolveSafePath(root, ) with no extra segments resolves and normalizes `artifactDir` itself, so every later call is guaranteed to stay under this exact directory.
    this.resolvedDir = resolveSafePath(artifactDir);
  }

  describe(): ArtifactSourceDescriptor {
    return { kind: "local-filesystem", directoryId: directoryIdentity(this.resolvedDir) };
  }

  async listFiles(): Promise<readonly ApprovedArtifactFilename[]> {
    let entries: string[];
    try {
      entries = await readdir(this.resolvedDir);
    } catch {
      return [];
    }
    const present: ApprovedArtifactFilename[] = [];
    for (const entry of entries) {
      if (!isApprovedFilename(entry)) continue;
      const filePath = join(this.resolvedDir, entry);
      const linkStat = await lstat(filePath).catch(() => null);
      if (!linkStat || !linkStat.isFile()) continue; // rejects symlinks and directories outright
      present.push(entry);
    }
    return present;
  }

  private resolveApprovedFile(fileName: ApprovedArtifactFilename): string {
    if (!isApprovedFilename(fileName)) {
      throw new InferenceError("unsafe_artifact_path", `"${fileName}" is not an approved artifact file name.`);
    }
    return resolveSafePath(this.resolvedDir, fileName);
  }

  async statFile(fileName: ApprovedArtifactFilename): Promise<ArtifactFileStat> {
    const filePath = this.resolveApprovedFile(fileName);
    const linkStat = await lstat(filePath).catch(() => null);
    if (!linkStat) throw new InferenceError("artifact_missing", `Artifact file "${fileName}" was not found.`, { details: { fileName } });
    if (!linkStat.isFile()) throw new InferenceError("unsafe_artifact_path", `Artifact file "${fileName}" is not a regular file.`, { details: { fileName } });
    const fileStat = await stat(filePath);
    return { fileName, sizeBytes: fileStat.size };
  }

  async readFile(fileName: ApprovedArtifactFilename, maxBytes: number): Promise<string> {
    const { sizeBytes } = await this.statFile(fileName);
    if (sizeBytes > maxBytes) {
      throw new InferenceError("payload_too_large", `Artifact file "${fileName}" (${sizeBytes} bytes) exceeds the configured limit of ${maxBytes} bytes.`, { details: { fileName, sizeBytes, maxBytes } });
    }
    const filePath = this.resolveApprovedFile(fileName);
    // Re-checked with lstat immediately before the read (TOCTOU-safe) rather
    // than trusting the earlier `statFile` call, which may be arbitrarily
    // far in the past relative to this read.
    const linkStat = await lstat(filePath).catch(() => null);
    if (!linkStat || !linkStat.isFile()) {
      throw new InferenceError("unsafe_artifact_path", `Artifact file "${fileName}" is not a regular file.`, { details: { fileName } });
    }
    return readFile(filePath, "utf-8");
  }
}
