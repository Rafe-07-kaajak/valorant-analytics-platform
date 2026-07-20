import { createHash } from "node:crypto";
import { stableStringify } from "@repo/vlr-ingestion";

/**
 * Deterministic release identity — mirrors
 * `services/model-inference/src/runtimePackage/runtimePackageVersion.ts`'s
 * `computeRuntimePackageVersion` exactly: the same source commit, the same
 * runtime package, the same lockfile, and the same application source
 * always reproduce the same `releaseVersion`. Deliberately excludes
 * `generatedAt`, hostnames, absolute paths, and any random identifier —
 * see TASK-049 section 4. `sourceCommitSha` is optional (Git state is
 * best-effort) so a release built outside a Git checkout still produces a
 * reproducible identity, just without commit pinning.
 */

export interface ReleaseVersionInputs {
  readonly sourceCommitSha: string | undefined;
  readonly runtimePackageVersion: string;
  readonly modelVersion: string;
  readonly sourceFeatureDatasetVersion: string;
  readonly applicationBuildFingerprint: string;
  readonly releaseRulesVersion: string;
  readonly lockfileHash: string;
  readonly configSchemaVersion: string;
}

export function computeReleaseVersion(inputs: ReleaseVersionInputs): string {
  const canonical = stableStringify({
    releaseRulesVersion: inputs.releaseRulesVersion,
    sourceCommitSha: inputs.sourceCommitSha ?? null,
    runtimePackageVersion: inputs.runtimePackageVersion,
    modelVersion: inputs.modelVersion,
    sourceFeatureDatasetVersion: inputs.sourceFeatureDatasetVersion,
    applicationBuildFingerprint: inputs.applicationBuildFingerprint,
    lockfileHash: inputs.lockfileHash,
    configSchemaVersion: inputs.configSchemaVersion,
  });
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}
