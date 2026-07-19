import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { buildHistoricalCatalog, validateCatalogFilters } from "./historicalCatalog";
import { resetHistoricalRepositoryCacheForTesting } from "./historicalFeatureRepository";
import { PredictionApiError } from "./errors";
import { buildFixtureFeatureDataset, FIXTURE_HISTORICAL_ROWS } from "./testFixtures/buildFixtureFeatureDataset";

describe("historicalCatalog", () => {
  let rootDir: string | undefined;

  beforeEach(() => {
    resetHistoricalRepositoryCacheForTesting();
    delete process.env.REAL_PREDICTION_FEATURE_DATA_DIR;
    delete process.env.REAL_PREDICTION_CATALOG_LIMIT;
  });

  afterEach(async () => {
    resetHistoricalRepositoryCacheForTesting();
    delete process.env.REAL_PREDICTION_FEATURE_DATA_DIR;
    delete process.env.REAL_PREDICTION_CATALOG_LIMIT;
    if (rootDir) {
      await rm(rootDir, { recursive: true, force: true });
      rootDir = undefined;
    }
  });

  async function withFixture() {
    const fixture = await buildFixtureFeatureDataset();
    rootDir = fixture.rootDir;
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = fixture.rootDir;
  }

  it("throws historical_data_unavailable when no dataset is present", async () => {
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = "/nonexistent-directory-for-tests";
    await expect(buildHistoricalCatalog({})).rejects.toMatchObject({ code: "historical_data_unavailable" });
  });

  it("returns every fixture row with no filters, sorted chronologically ascending", async () => {
    await withFixture();
    const catalog = await buildHistoricalCatalog({});
    expect(catalog.matches).toHaveLength(FIXTURE_HISTORICAL_ROWS.length);
    expect(catalog.total).toBe(FIXTURE_HISTORICAL_ROWS.length);
    expect(catalog.matches[0].matchInternalId).toBe("vlr:match:1001");
    expect(catalog.matches[1].matchInternalId).toBe("vlr:match:1002");
  });

  it("never includes label/outcome fields in a catalog entry", async () => {
    await withFixture();
    const catalog = await buildHistoricalCatalog({});
    for (const match of catalog.matches) {
      expect(match).not.toHaveProperty("labelTeamAWin");
      expect(match).not.toHaveProperty("labelWinnerProviderId");
      expect(match).not.toHaveProperty("labelSeriesScore");
    }
  });

  it("filters by eventFamily", async () => {
    await withFixture();
    const catalog = await buildHistoricalCatalog({ eventFamily: "masters" });
    expect(catalog.matches).toHaveLength(1);
    expect(catalog.matches[0].matchInternalId).toBe("vlr:match:1002");
  });

  it("filters by teamProviderId matching either side", async () => {
    await withFixture();
    const catalog = await buildHistoricalCatalog({ teamProviderId: "vlr:team:3" });
    expect(catalog.matches).toHaveLength(1);
    expect(catalog.matches[0].matchInternalId).toBe("vlr:match:1002");
  });

  it("filters by scheduledAfter/scheduledBefore", async () => {
    await withFixture();
    const catalog = await buildHistoricalCatalog({ scheduledAfter: "2026-01-15T00:00:00.000Z" });
    expect(catalog.matches.map((m) => m.matchInternalId)).toEqual(["vlr:match:1002"]);
  });

  it("bounds the response to the configured catalog limit even when a larger limit is requested", async () => {
    process.env.REAL_PREDICTION_CATALOG_LIMIT = "1";
    await withFixture();
    const catalog = await buildHistoricalCatalog({ limit: 50 });
    expect(catalog.matches).toHaveLength(1);
    expect(catalog.total).toBe(FIXTURE_HISTORICAL_ROWS.length);
  });

  describe("validateCatalogFilters", () => {
    it("accepts a valid, fully-populated filter set", () => {
      const filters = validateCatalogFilters({ eventFamily: "masters", teamProviderId: "vlr:team:1", scheduledAfter: "2026-01-01T00:00:00.000Z", scheduledBefore: "2026-12-31T00:00:00.000Z", limit: "10" });
      expect(filters).toMatchObject({ eventFamily: "masters", teamProviderId: "vlr:team:1", limit: 10 });
    });

    it("rejects a non-ISO scheduledAfter value", () => {
      expect(() => validateCatalogFilters({ scheduledAfter: "not-a-date" })).toThrow(PredictionApiError);
    });

    it("rejects a non-positive limit", () => {
      expect(() => validateCatalogFilters({ limit: "0" })).toThrow(PredictionApiError);
      expect(() => validateCatalogFilters({ limit: "-5" })).toThrow(PredictionApiError);
      expect(() => validateCatalogFilters({ limit: "not-a-number" })).toThrow(PredictionApiError);
    });

    it("ignores unset (undefined) filters", () => {
      expect(validateCatalogFilters({})).toEqual({});
    });
  });
});
