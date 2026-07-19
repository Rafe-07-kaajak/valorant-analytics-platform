import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { resetHistoricalRepositoryCacheForTesting } from "../../../../../server/prediction/historicalFeatureRepository";
import { buildFixtureFeatureDataset, FIXTURE_HISTORICAL_ROWS } from "../../../../../server/prediction/testFixtures/buildFixtureFeatureDataset";
import { GET } from "./route";

describe("GET /api/internal/prediction/catalog", () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    resetHistoricalRepositoryCacheForTesting();
    delete process.env.REAL_PREDICTION_FEATURE_DATA_DIR;
  });

  afterEach(async () => {
    resetHistoricalRepositoryCacheForTesting();
    delete process.env.REAL_PREDICTION_FEATURE_DATA_DIR;
    for (const dir of tempDirs.splice(0)) await rm(dir, { recursive: true, force: true });
  });

  async function withFixture() {
    const dataset = await buildFixtureFeatureDataset();
    tempDirs.push(dataset.rootDir);
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = dataset.rootDir;
  }

  it("returns the full fixture catalog with no query params", async () => {
    await withFixture();
    const response = await GET(new Request("http://localhost/api/internal/prediction/catalog"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.matches).toHaveLength(FIXTURE_HISTORICAL_ROWS.length);
  });

  it("applies the eventFamily filter from the query string", async () => {
    await withFixture();
    const response = await GET(new Request("http://localhost/api/internal/prediction/catalog?eventFamily=masters"));
    const body = await response.json();
    expect(body.matches).toHaveLength(1);
    expect(body.matches[0].eventFamily).toBe("masters");
  });

  it("returns request_invalid (400) for a malformed scheduledAfter value", async () => {
    await withFixture();
    const response = await GET(new Request("http://localhost/api/internal/prediction/catalog?scheduledAfter=not-a-date"));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("request_invalid");
  });

  it("returns historical_data_unavailable (503) when no dataset is present", async () => {
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = "/nonexistent-directory-for-tests";
    const response = await GET(new Request("http://localhost/api/internal/prediction/catalog"));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.code).toBe("historical_data_unavailable");
  });

  it("never includes a label field anywhere in the response body", async () => {
    await withFixture();
    const response = await GET(new Request("http://localhost/api/internal/prediction/catalog"));
    const rawBody = await response.text();
    expect(rawBody).not.toContain("labelTeamAWin");
    expect(rawBody).not.toContain("labelWinnerProviderId");
  });
});
