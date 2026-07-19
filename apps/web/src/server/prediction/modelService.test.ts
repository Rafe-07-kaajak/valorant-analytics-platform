import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { buildFixtureRuntimePackage } from "@repo/model-inference/testFixtures/runtimePackage";
import { getModelServiceSnapshotSync, getReadyModelService, setModelServiceForTesting } from "./modelService";
import { resetRuntimePackageCacheForTesting } from "./runtimePackageSource";

describe("modelService source-mode wiring", () => {
  const dirsToClean: string[] = [];

  beforeEach(() => {
    setModelServiceForTesting(null);
    resetRuntimePackageCacheForTesting();
    delete process.env.REAL_PREDICTION_SOURCE_MODE;
    delete process.env.REAL_PREDICTION_RUNTIME_PACKAGE_DIR;
    delete process.env.MODEL_INFERENCE_ARTIFACT_DIR;
  });

  afterEach(async () => {
    setModelServiceForTesting(null);
    resetRuntimePackageCacheForTesting();
    delete process.env.REAL_PREDICTION_SOURCE_MODE;
    delete process.env.REAL_PREDICTION_RUNTIME_PACKAGE_DIR;
    delete process.env.MODEL_INFERENCE_ARTIFACT_DIR;
    for (const dir of dirsToClean.splice(0)) await rm(dir, { recursive: true, force: true });
  });

  it("local-generated mode (default): getModelServiceSnapshotSync returns a service without forcing a load", () => {
    const service = getModelServiceSnapshotSync();
    expect(service.readiness().status).toBe("unloaded");
  });

  it("runtime-package mode: builds a working PredictionService pointed at the package's model directory", async () => {
    const fixture = await buildFixtureRuntimePackage();
    dirsToClean.push(fixture.outputDir, fixture.sourceModelDir, fixture.sourceFeatureDataDir);
    process.env.REAL_PREDICTION_SOURCE_MODE = "runtime-package";
    process.env.REAL_PREDICTION_RUNTIME_PACKAGE_DIR = fixture.outputDir;

    const service = await getReadyModelService();
    const snapshot = service.readiness();
    expect(snapshot.ready).toBe(true);
    expect(snapshot.modelVersion).toBe(fixture.buildResult.manifest.modelVersion);
  });

  it("runtime-package mode: a missing package never throws — getReadyModelService resolves to a not-ready placeholder", async () => {
    process.env.REAL_PREDICTION_SOURCE_MODE = "runtime-package";
    process.env.REAL_PREDICTION_RUNTIME_PACKAGE_DIR = "/nonexistent-runtime-package-dir-for-tests";

    const service = await getReadyModelService();
    expect(service.readiness().ready).toBe(false);
  });

  it("runtime-package mode: getModelServiceSnapshotSync never forces a load attempt even when the package is invalid", () => {
    process.env.REAL_PREDICTION_SOURCE_MODE = "runtime-package";
    process.env.REAL_PREDICTION_RUNTIME_PACKAGE_DIR = "/nonexistent-runtime-package-dir-for-tests";

    const service = getModelServiceSnapshotSync();
    expect(service.readiness().status).toBe("unloaded");
  });
});
