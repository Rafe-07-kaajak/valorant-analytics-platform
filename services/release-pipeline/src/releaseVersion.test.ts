import { describe, expect, it } from "vitest";
import { computeReleaseVersion, type ReleaseVersionInputs } from "./releaseVersion";

const BASE_INPUTS: ReleaseVersionInputs = {
  sourceCommitSha: "abc123",
  runtimePackageVersion: "rp-v1",
  modelVersion: "model-v1",
  sourceFeatureDatasetVersion: "features-v1",
  applicationBuildFingerprint: "app-fp-1",
  releaseRulesVersion: "release-rules@1.0.0",
  lockfileHash: "lockfile-hash-1",
  configSchemaVersion: "config-schema@1.0.0",
};

describe("computeReleaseVersion", () => {
  it("is deterministic for identical inputs", () => {
    expect(computeReleaseVersion(BASE_INPUTS)).toBe(computeReleaseVersion({ ...BASE_INPUTS }));
  });

  it("produces a 16-character lowercase hex string", () => {
    expect(computeReleaseVersion(BASE_INPUTS)).toMatch(/^[0-9a-f]{16}$/);
  });

  it("changes when sourceCommitSha changes", () => {
    expect(computeReleaseVersion({ ...BASE_INPUTS, sourceCommitSha: "def456" })).not.toBe(computeReleaseVersion(BASE_INPUTS));
  });

  it("changes when runtimePackageVersion changes", () => {
    expect(computeReleaseVersion({ ...BASE_INPUTS, runtimePackageVersion: "rp-v2" })).not.toBe(computeReleaseVersion(BASE_INPUTS));
  });

  it("changes when applicationBuildFingerprint changes", () => {
    expect(computeReleaseVersion({ ...BASE_INPUTS, applicationBuildFingerprint: "app-fp-2" })).not.toBe(computeReleaseVersion(BASE_INPUTS));
  });

  it("changes when lockfileHash changes", () => {
    expect(computeReleaseVersion({ ...BASE_INPUTS, lockfileHash: "lockfile-hash-2" })).not.toBe(computeReleaseVersion(BASE_INPUTS));
  });

  it("changes when configSchemaVersion changes", () => {
    expect(computeReleaseVersion({ ...BASE_INPUTS, configSchemaVersion: "config-schema@2.0.0" })).not.toBe(computeReleaseVersion(BASE_INPUTS));
  });

  it("is stable when sourceCommitSha is undefined (best-effort Git state)", () => {
    const withoutCommit: ReleaseVersionInputs = { ...BASE_INPUTS, sourceCommitSha: undefined };
    expect(computeReleaseVersion(withoutCommit)).toBe(computeReleaseVersion({ ...withoutCommit }));
    expect(computeReleaseVersion(withoutCommit)).not.toBe(computeReleaseVersion(BASE_INPUTS));
  });
});
