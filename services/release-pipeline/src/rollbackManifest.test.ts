import { describe, expect, it } from "vitest";
import { buildRollbackManifest, type RollbackReleaseRef } from "./rollbackManifest";

const CURRENT: RollbackReleaseRef = { releaseVersion: "release-2", runtimePackageVersion: "rp-2", modelVersion: "model-2", sourceFeatureDatasetVersion: "features-2", featureSchemaVersion: "schema-v1", featureRulesVersion: "rules-v1" };

describe("buildRollbackManifest", () => {
  it("is trivially compatible with no previous release recorded", () => {
    const manifest = buildRollbackManifest(CURRENT);
    expect(manifest.rollbackCompatible).toBe(true);
    expect(manifest.rollbackBlockers).toEqual(["No previous release is recorded — there is nothing to roll back to yet."]);
    expect(manifest.previousReleaseVersion).toBeUndefined();
  });

  it("is compatible when the previous release shares the same feature schema/rules version", () => {
    const previous: RollbackReleaseRef = { releaseVersion: "release-1", runtimePackageVersion: "rp-1", modelVersion: "model-1", sourceFeatureDatasetVersion: "features-1", featureSchemaVersion: "schema-v1", featureRulesVersion: "rules-v1" };
    const manifest = buildRollbackManifest(CURRENT, previous);
    expect(manifest.rollbackCompatible).toBe(true);
    expect(manifest.rollbackBlockers).toEqual([]);
    expect(manifest.previousReleaseVersion).toBe("release-1");
    expect(manifest.previousRuntimePackageVersion).toBe("rp-1");
  });

  it("is incompatible when featureSchemaVersion differs, with a specific blocker", () => {
    const previous: RollbackReleaseRef = { releaseVersion: "release-1", runtimePackageVersion: "rp-1", modelVersion: "model-1", sourceFeatureDatasetVersion: "features-1", featureSchemaVersion: "schema-v0", featureRulesVersion: "rules-v1" };
    const manifest = buildRollbackManifest(CURRENT, previous);
    expect(manifest.rollbackCompatible).toBe(false);
    expect(manifest.rollbackBlockers).toHaveLength(1);
    expect(manifest.rollbackBlockers[0]).toContain("schema");
  });

  it("always distinguishes application rollback, runtime package rollback, and real-mode disablement", () => {
    const manifest = buildRollbackManifest(CURRENT);
    expect(manifest.rollbackKinds.applicationRollback).toBeTruthy();
    expect(manifest.rollbackKinds.runtimePackageRollback).toBeTruthy();
    expect(manifest.rollbackKinds.realModeDisablement).toBeTruthy();
  });

  it("always preserves the synthetic-mode fallback policy text", () => {
    const manifest = buildRollbackManifest(CURRENT);
    expect(manifest.syntheticModeEmergencyFallbackPolicy).toContain("Synthetic scenario mode");
  });

  it("never includes a destructive-sounding rollback step", () => {
    const manifest = buildRollbackManifest(CURRENT, { ...CURRENT, releaseVersion: "release-1" });
    const allText = JSON.stringify(manifest).toLowerCase();
    for (const forbidden of ["drop table", "delete from", "rm -rf", "truncate"]) {
      expect(allText).not.toContain(forbidden);
    }
  });
});
