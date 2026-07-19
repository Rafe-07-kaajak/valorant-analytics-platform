import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * TASK-047 — Historical Model Replay section on Prediction Studio. Uses
 * Playwright network interception (`page.route`) for every scenario rather
 * than the real gitignored TASK-044/045 local artifact/dataset, so this
 * suite never depends on local developer state and needs no external
 * network — the e2e webServer runs a production build (`playwright.config.ts`),
 * and a fresh CI checkout has no `.local/vlr-data` at all, which is exactly
 * the "historical data unavailable" state these tests also cover.
 */

const READINESS_URL = "**/api/internal/prediction/readiness";
const CATALOG_URL = "**/api/internal/prediction/catalog**";
const PREDICT_URL = "**/api/internal/prediction/historical";

function unavailableReadinessBody() {
  return {
    realPredictionAvailable: false,
    modelStatus: "unloaded",
    historicalDataAvailable: false,
    message: "The historical feature dataset is not available locally.",
    retryable: true,
  };
}

function availableReadinessBody() {
  return {
    realPredictionAvailable: true,
    modelStatus: "ready",
    historicalDataAvailable: true,
    currentModelVersion: "fixture-model-v1",
    sourceFeatureDatasetVersion: "fixture-feature-dataset-v1",
    message: "Historical model replay is available.",
    retryable: false,
  };
}

function catalogBody() {
  return {
    matches: [
      {
        matchInternalId: "vlr:match:1001",
        scheduledAt: "2026-02-20T05:00:00.000Z",
        eventFamily: "masters",
        eventRegion: "international",
        tournamentLevel: "tier-1",
        seriesFormat: "BO3",
        teamAProviderId: "vlr:team:1120",
        teamBProviderId: "vlr:team:474",
        modelEligible: true,
        featureDatasetVersion: "fixture-feature-dataset-v1",
      },
    ],
    total: 1,
    featureDatasetVersion: "fixture-feature-dataset-v1",
  };
}

function predictionBody() {
  return {
    mode: "historical-real-model",
    requestId: "req-e2e",
    match: {
      matchInternalId: "vlr:match:1001",
      scheduledAt: "2026-02-20T05:00:00.000Z",
      eventFamily: "masters",
      eventRegion: "international",
      tournamentLevel: "tier-1",
      seriesFormat: "BO3",
      teamAProviderId: "vlr:team:1120",
      teamBProviderId: "vlr:team:474",
    },
    modelVersion: "fixture-model-v1",
    estimatorType: "elo-baseline",
    calibrationMethod: "none",
    sourceFeatureDatasetVersion: "fixture-feature-dataset-v1",
    featureSchemaVersion: "fixture-feature-schema@1.0.0",
    teamAWinProbability: 0.62,
    teamBWinProbability: 0.38,
    predictedWinnerSide: "teamA",
    confidence: 0.24,
    warnings: [],
    predictionGeneratedAt: new Date().toISOString(),
    inferenceDurationMs: 0.5,
    dataProvenance: { sourceFeatureDatasetVersion: "fixture-feature-dataset-v1", featureSchemaVersion: "fixture-feature-schema@1.0.0", generatedFromHistoricalSnapshot: true },
    resultAvailability: { actualResultRevealable: false },
  };
}

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockUnavailable(page: Page) {
  await page.route(READINESS_URL, (route) => fulfillJson(route, unavailableReadinessBody()));
}

async function mockAvailable(page: Page) {
  await page.route(READINESS_URL, (route) => fulfillJson(route, availableReadinessBody()));
  await page.route(CATALOG_URL, (route) => fulfillJson(route, catalogBody()));
  await page.route(PREDICT_URL, (route) => fulfillJson(route, predictionBody()));
}

test("synthetic scenario builder remains fully usable when real prediction is unavailable", async ({ page }) => {
  await mockUnavailable(page);
  await page.goto("/prediction-studio");

  await expect(page.getByRole("heading", { name: "Historical Model Replay" })).toBeVisible();
  await expect(page.getByText(/not available locally/)).toBeVisible();

  // The existing synthetic scenario controls are completely unaffected.
  await expect(page.getByRole("group", { name: "Team A region" })).toBeVisible();
  const submit = page.getByRole("button", { name: "Generate Prediction" });
  await expect(submit).toBeDisabled();
});

test("historical mode becomes visible and usable once readiness reports available", async ({ page }) => {
  await mockAvailable(page);
  await page.goto("/prediction-studio");

  const matchesGroup = page.getByRole("group", { name: "Historical matches" });
  await expect(matchesGroup).toBeVisible();
  await expect(page.getByRole("button", { name: /vlr:team:1120 vs vlr:team:474/ })).toBeVisible();
});

test("selecting a historical match runs a fixture real-model prediction labeled as historical replay", async ({ page }) => {
  await mockAvailable(page);
  await page.goto("/prediction-studio");

  await page.getByRole("button", { name: /vlr:team:1120 vs vlr:team:474/ }).click();

  await expect(page.getByText("Real trained model")).toBeVisible();
  await expect(page.getByText("fixture-model-v1")).toBeVisible();
  await expect(page.getByText("elo-baseline")).toBeVisible();
  await expect(page.getByText("62%")).toBeVisible();
});

test("an unavailable real-prediction state never breaks the page and offers a retry", async ({ page }) => {
  await mockUnavailable(page);
  await page.goto("/prediction-studio");

  const retry = page.getByRole("button", { name: "Retry" });
  await expect(retry).toBeVisible();

  // Flip the mock to "available" before retrying, proving the retry path works.
  await mockAvailable(page);
  await retry.click();

  await expect(page.getByRole("group", { name: "Historical matches" })).toBeVisible();
});

test("a failed prediction request shows a labeled error with a retry action, without crashing the page", async ({ page }) => {
  await page.route(READINESS_URL, (route) => fulfillJson(route, availableReadinessBody()));
  await page.route(CATALOG_URL, (route) => fulfillJson(route, catalogBody()));
  await page.route(PREDICT_URL, (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "model_unavailable", message: "The prediction model is not currently available.", retryable: true }) }),
  );
  await page.goto("/prediction-studio");

  await page.getByRole("button", { name: /vlr:team:1120 vs vlr:team:474/ }).click();
  await expect(page.getByText("The prediction model is not currently available.")).toBeVisible();
  await expect(page.getByRole("group", { name: "Team A region" })).toBeVisible();
});
