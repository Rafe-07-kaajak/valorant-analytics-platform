import { describe, expect, it } from "vitest";
import { buildReleaseManifest, type BuildReleaseManifestInputs } from "./manifest";

const BASE_INPUTS: BuildReleaseManifestInputs = {
  sourceCommitSha: "abc123",
  sourceBranch: "master",
  applicationFingerprint: "app-fp-1",
  applicationFiles: [
    { path: "package.json", sha256: "hash1", sizeBytes: 10 },
    { path: "src/a.ts", sha256: "hash2", sizeBytes: 20 },
  ],
  nodeVersionRequirement: ">=20.0.0",
  pnpmVersion: "pnpm@11.10.0",
  lockfileHash: "lockfile-hash-1",
  runtimePackageVersion: "rp-v1",
  modelVersion: "model-v1",
  estimatorType: "elo-baseline",
  calibrationMethod: "none",
  sourceFeatureDatasetVersion: "features-v1",
  featureSchemaVersion: "schema-v1",
  featureRulesVersion: "rules-v1",
  runtimePackageFiles: [{ fileName: "model/model.json", sha256: "hash3", sizeBytes: 30 }],
  configSchemaVersion: "config-schema@1.0.0",
  runtimePackageTotalBytes: 1000,
  configTotalBytes: 200,
  securityAssertions: { noSecretsDetected: true, noAbsolutePaths: true, noRawFeatureData: true, noRawLabels: true, allowlistEnforced: true },
};

describe("buildReleaseManifest", () => {
  it("is a pure function: identical inputs produce an identical releaseVersion (generatedAt differs, excluded from the hash)", async () => {
    const first = buildReleaseManifest(BASE_INPUTS);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 5));
    const second = buildReleaseManifest(BASE_INPUTS);
    expect(second.releaseVersion).toBe(first.releaseVersion);
  });

  it("computes a correct grand total size", () => {
    const manifest = buildReleaseManifest(BASE_INPUTS);
    expect(manifest.sizeSummaryBytes).toEqual({ applicationTotalBytes: 30, runtimePackageTotalBytes: 1000, configTotalBytes: 200, grandTotalBytes: 1230 });
  });

  it("sorts applicationFiles and runtimePackageFiles by fileName", () => {
    const manifest = buildReleaseManifest({ ...BASE_INPUTS, applicationFiles: [...BASE_INPUTS.applicationFiles].reverse() });
    expect(manifest.applicationFiles.map((file) => file.fileName)).toEqual(["package.json", "src/a.ts"]);
  });

  it("never includes an absolute-looking path in applicationFiles", () => {
    const manifest = buildReleaseManifest(BASE_INPUTS);
    for (const file of manifest.applicationFiles) {
      expect(file.fileName.startsWith("/")).toBe(false);
      expect(file.fileName).not.toMatch(/^[A-Za-z]:\\/);
    }
  });

  it("defaults testVerificationSummary/buildVerificationSummary to performed:false when omitted", () => {
    const manifest = buildReleaseManifest(BASE_INPUTS);
    expect(manifest.testVerificationSummary).toEqual({ performed: false });
    expect(manifest.buildVerificationSummary).toEqual({ performed: false });
  });

  it("threads through a real verification summary when provided", () => {
    const manifest = buildReleaseManifest({ ...BASE_INPUTS, testVerificationSummary: { performed: true, lintPassed: true, typecheckPassed: true, testsPassed: true } });
    expect(manifest.testVerificationSummary).toEqual({ performed: true, lintPassed: true, typecheckPassed: true, testsPassed: true });
  });

  it("omits sourceCommitSha/sourceBranch entirely when undefined, rather than serializing null", () => {
    const manifest = buildReleaseManifest({ ...BASE_INPUTS, sourceCommitSha: undefined, sourceBranch: undefined });
    expect("sourceCommitSha" in manifest).toBe(false);
    expect("sourceBranch" in manifest).toBe(false);
  });

  it("rollbackCompatibilityMetadata defaults to rollbackCompatible: null with no previous release", () => {
    const manifest = buildReleaseManifest(BASE_INPUTS);
    expect(manifest.rollbackCompatibilityMetadata).toEqual({ rollbackCompatible: null });
  });
});
