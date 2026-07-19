import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { buildFixtureRuntimePackage } from "@repo/model-inference/testFixtures/runtimePackage";
import {
  getFeatureDatasetManifestSafe,
  getHistoricalRowById,
  listHistoricalRows,
  resetHistoricalRepositoryCacheForTesting,
  validateMatchInternalId,
} from "./historicalFeatureRepository";
import { PredictionApiError } from "./errors";
import { resetRuntimePackageCacheForTesting } from "./runtimePackageSource";
import { buildFixtureFeatureDataset, FIXTURE_HISTORICAL_ROWS, FIXTURE_FEATURE_DATASET_VERSION } from "./testFixtures/buildFixtureFeatureDataset";

describe("historicalFeatureRepository", () => {
  let rootDir: string | undefined;

  beforeEach(() => {
    resetHistoricalRepositoryCacheForTesting();
    delete process.env.REAL_PREDICTION_FEATURE_DATA_DIR;
  });

  afterEach(async () => {
    resetHistoricalRepositoryCacheForTesting();
    delete process.env.REAL_PREDICTION_FEATURE_DATA_DIR;
    if (rootDir) {
      await rm(rootDir, { recursive: true, force: true });
      rootDir = undefined;
    }
  });

  it("loads a valid fixture dataset and returns the manifest", async () => {
    const fixture = await buildFixtureFeatureDataset();
    rootDir = fixture.rootDir;
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = fixture.rootDir;

    const manifest = await getFeatureDatasetManifestSafe();
    expect(manifest?.featureDatasetVersion).toBe(FIXTURE_FEATURE_DATASET_VERSION);
    expect(manifest?.rowCount).toBe(FIXTURE_HISTORICAL_ROWS.length);
  });

  it("returns null (never throws) from getFeatureDatasetManifestSafe when the dataset directory is missing", async () => {
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = "/nonexistent-directory-for-tests";
    const manifest = await getFeatureDatasetManifestSafe();
    expect(manifest).toBeNull();
  });

  it("throws historical_data_unavailable when a row lookup is attempted with no dataset present", async () => {
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = "/nonexistent-directory-for-tests";
    await expect(getHistoricalRowById("vlr:match:1001")).rejects.toMatchObject({ code: "historical_data_unavailable" });
  });

  it("loads a row by exact matchInternalId, stripping nothing at read time (labels remain on the raw row for the adapter to control)", async () => {
    const fixture = await buildFixtureFeatureDataset();
    rootDir = fixture.rootDir;
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = fixture.rootDir;

    const row = await getHistoricalRowById("vlr:match:1001");
    expect(row.matchInternalId).toBe("vlr:match:1001");
    expect(row.teamAProviderId).toBe("vlr:team:1");
  });

  it("throws historical_match_not_found for an unknown matchInternalId", async () => {
    const fixture = await buildFixtureFeatureDataset();
    rootDir = fixture.rootDir;
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = fixture.rootDir;

    await expect(getHistoricalRowById("vlr:match:does-not-exist")).rejects.toMatchObject({ code: "historical_match_not_found" });
  });

  it("throws feature_row_invalid when the dataset contains a duplicate matchInternalId", async () => {
    const duplicateRow = { ...FIXTURE_HISTORICAL_ROWS[0] };
    const fixture = await buildFixtureFeatureDataset([FIXTURE_HISTORICAL_ROWS[0], duplicateRow]);
    rootDir = fixture.rootDir;
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = fixture.rootDir;

    await expect(listHistoricalRows()).rejects.toMatchObject({ code: "feature_row_invalid" });
  });

  it("caches the dataset across repeated calls (single load, verified by mutating the fixture file after first read)", async () => {
    const fixture = await buildFixtureFeatureDataset();
    rootDir = fixture.rootDir;
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = fixture.rootDir;

    const first = await listHistoricalRows();
    expect(first).toHaveLength(FIXTURE_HISTORICAL_ROWS.length);

    // Even if the underlying directory disappears, the cached in-memory
    // dataset must still serve subsequent calls without re-reading disk.
    await rm(fixture.rootDir, { recursive: true, force: true });
    rootDir = undefined;
    const second = await listHistoricalRows();
    expect(second).toHaveLength(FIXTURE_HISTORICAL_ROWS.length);
  });

  describe("validateMatchInternalId", () => {
    it("accepts a non-empty string", () => {
      expect(validateMatchInternalId("vlr:match:1001")).toBe("vlr:match:1001");
    });

    it.each([undefined, null, 123, "", "   ", "x".repeat(257), {}, []])("rejects invalid input %j", (value) => {
      expect(() => validateMatchInternalId(value)).toThrow(PredictionApiError);
    });
  });

  describe("runtime-package source mode (TASK-048)", () => {
    const dirsToClean: string[] = [];

    beforeEach(() => {
      resetRuntimePackageCacheForTesting();
      delete process.env.REAL_PREDICTION_SOURCE_MODE;
      delete process.env.REAL_PREDICTION_RUNTIME_PACKAGE_DIR;
    });

    afterEach(async () => {
      resetRuntimePackageCacheForTesting();
      delete process.env.REAL_PREDICTION_SOURCE_MODE;
      delete process.env.REAL_PREDICTION_RUNTIME_PACKAGE_DIR;
      for (const dir of dirsToClean.splice(0)) await rm(dir, { recursive: true, force: true });
    });

    it("loads historical rows from a packaged runtime package, with labels absent", async () => {
      const fixture = await buildFixtureRuntimePackage();
      dirsToClean.push(fixture.outputDir, fixture.sourceModelDir, fixture.sourceFeatureDataDir);
      process.env.REAL_PREDICTION_SOURCE_MODE = "runtime-package";
      process.env.REAL_PREDICTION_RUNTIME_PACKAGE_DIR = fixture.outputDir;

      const manifest = await getFeatureDatasetManifestSafe();
      expect(manifest?.rowCount).toBe(fixture.buildResult.manifest.historical.rowCount);

      const rows = await listHistoricalRows();
      expect(rows.length).toBe(fixture.buildResult.manifest.historical.rowCount);
      for (const row of rows) {
        expect(row).not.toHaveProperty("labelTeamAWin");
        expect(row).not.toHaveProperty("labelWinnerProviderId");
        expect(row).not.toHaveProperty("labelSeriesScore");
        expect(row).not.toHaveProperty("labelMapCountPlayed");
      }
    });

    it("reports historical_data_unavailable (via null manifest) when the runtime package is missing", async () => {
      process.env.REAL_PREDICTION_SOURCE_MODE = "runtime-package";
      process.env.REAL_PREDICTION_RUNTIME_PACKAGE_DIR = "/nonexistent-runtime-package-dir-for-tests";

      const manifest = await getFeatureDatasetManifestSafe();
      expect(manifest).toBeNull();
      await expect(getHistoricalRowById("vlr:match:fixture-1001")).rejects.toBeInstanceOf(PredictionApiError);
    });
  });

  it("real local dataset smoke test (skipped if the gitignored TASK-044 feature export is not present)", async () => {
    const manifest = await getFeatureDatasetManifestSafe();
    if (!manifest) {
      // No real dataset in this checkout (e.g. CI) — synthetic mode remains
      // fully usable regardless, which is exactly the "unavailable" path
      // covered by the other tests in this file.
      return;
    }
    expect(manifest.rowCount).toBeGreaterThan(0);
    const rows = await listHistoricalRows();
    expect(rows.length).toBe(manifest.rowCount);
    const row = await getHistoricalRowById(rows[0].matchInternalId);
    expect(row.matchInternalId).toBe(rows[0].matchInternalId);
  });
});
