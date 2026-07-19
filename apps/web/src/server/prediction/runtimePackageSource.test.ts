import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { buildFixtureRuntimePackage } from "@repo/model-inference/testFixtures/runtimePackage";
import { getRuntimePackage, resetRuntimePackageCacheForTesting } from "./runtimePackageSource";
import { PredictionApiError } from "./errors";

describe("runtimePackageSource", () => {
  const dirsToClean: string[] = [];

  beforeEach(() => {
    resetRuntimePackageCacheForTesting();
    delete process.env.REAL_PREDICTION_RUNTIME_PACKAGE_DIR;
    delete process.env.REAL_PREDICTION_EXPECTED_RUNTIME_PACKAGE_VERSION;
  });

  afterEach(async () => {
    resetRuntimePackageCacheForTesting();
    delete process.env.REAL_PREDICTION_RUNTIME_PACKAGE_DIR;
    delete process.env.REAL_PREDICTION_EXPECTED_RUNTIME_PACKAGE_VERSION;
    for (const dir of dirsToClean.splice(0)) await rm(dir, { recursive: true, force: true });
  });

  it("loads a valid fixture runtime package", async () => {
    const fixture = await buildFixtureRuntimePackage();
    dirsToClean.push(fixture.outputDir, fixture.sourceModelDir, fixture.sourceFeatureDataDir);
    process.env.REAL_PREDICTION_RUNTIME_PACKAGE_DIR = fixture.outputDir;

    const loaded = await getRuntimePackage();
    expect(loaded.manifest.runtimePackageVersion).toBe(fixture.buildResult.manifest.runtimePackageVersion);
    expect(loaded.historicalRows.length).toBeGreaterThan(0);
  });

  it("memoizes the load across repeated calls (single read, verified by removing the directory after first load)", async () => {
    const fixture = await buildFixtureRuntimePackage();
    dirsToClean.push(fixture.sourceModelDir, fixture.sourceFeatureDataDir);
    process.env.REAL_PREDICTION_RUNTIME_PACKAGE_DIR = fixture.outputDir;

    const first = await getRuntimePackage();
    await rm(fixture.outputDir, { recursive: true, force: true });
    const second = await getRuntimePackage();
    expect(second.manifest.runtimePackageVersion).toBe(first.manifest.runtimePackageVersion);
  });

  it("throws a PredictionApiError with code runtime_package_missing for a nonexistent directory", async () => {
    process.env.REAL_PREDICTION_RUNTIME_PACKAGE_DIR = "/nonexistent-runtime-package-dir-for-tests";
    await expect(getRuntimePackage()).rejects.toBeInstanceOf(PredictionApiError);
    resetRuntimePackageCacheForTesting();
    await expect(getRuntimePackage()).rejects.toMatchObject({ code: "runtime_package_missing" });
  });

  it("throws runtime_package_version_mismatch when an expected version is pinned and disagrees", async () => {
    const fixture = await buildFixtureRuntimePackage();
    dirsToClean.push(fixture.outputDir, fixture.sourceModelDir, fixture.sourceFeatureDataDir);
    process.env.REAL_PREDICTION_RUNTIME_PACKAGE_DIR = fixture.outputDir;
    process.env.REAL_PREDICTION_EXPECTED_RUNTIME_PACKAGE_VERSION = "not-the-real-version";

    await expect(getRuntimePackage()).rejects.toMatchObject({ code: "runtime_package_version_mismatch" });
  });

  it("resets on failure so a later call can retry after the package becomes available", async () => {
    process.env.REAL_PREDICTION_RUNTIME_PACKAGE_DIR = "/nonexistent-runtime-package-dir-for-tests";
    await expect(getRuntimePackage()).rejects.toBeInstanceOf(PredictionApiError);

    const fixture = await buildFixtureRuntimePackage();
    dirsToClean.push(fixture.outputDir, fixture.sourceModelDir, fixture.sourceFeatureDataDir);
    process.env.REAL_PREDICTION_RUNTIME_PACKAGE_DIR = fixture.outputDir;

    const loaded = await getRuntimePackage();
    expect(loaded.manifest.runtimePackageVersion).toBe(fixture.buildResult.manifest.runtimePackageVersion);
  });
});
