import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * TASK-048 — proves the "runtime-package" source mode is a safe, additive
 * extension of TASK-047's readiness contract: the frontend must behave
 * identically whether the backend reports `sourceMode: "local-generated"`
 * (today's default) or `sourceMode: "runtime-package"` (TASK-048), and a
 * missing/invalid runtime package must leave the synthetic scenario builder
 * fully usable — exactly the same "no source mutation, no network, fixture
 * only" pattern as `e2e/historical-replay.spec.ts`.
 */

const READINESS_URL = "**/api/internal/prediction/readiness";
const CATALOG_URL = "**/api/internal/prediction/catalog**";
const PREDICT_URL = "**/api/internal/prediction/historical";

function runtimePackageAvailableReadinessBody() {
  return {
    realPredictionAvailable: true,
    modelStatus: "ready",
    historicalDataAvailable: true,
    currentModelVersion: "fixture-model-v1",
    sourceFeatureDatasetVersion: "fixture-feature-dataset-v1",
    message: "Historical model replay is available.",
    retryable: false,
    sourceMode: "runtime-package",
    runtimePackageVersion: "c0bd5813eb4b8a04",
  };
}

function runtimePackageMissingReadinessBody() {
  return {
    realPredictionAvailable: false,
    modelStatus: "unloaded",
    historicalDataAvailable: false,
    message: "The historical feature dataset is not available locally.",
    retryable: true,
    sourceMode: "runtime-package",
  };
}

function catalogBody() {
  return {
    matches: [
      {
        matchInternalId: "vlr:match:2001",
        scheduledAt: "2026-03-01T05:00:00.000Z",
        eventFamily: "vct-americas",
        eventRegion: "americas",
        tournamentLevel: "tier-1",
        seriesFormat: "BO3",
        teamAProviderId: "vlr:team:501",
        teamBProviderId: "vlr:team:502",
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
    match: {
      matchInternalId: "vlr:match:2001",
      scheduledAt: "2026-03-01T05:00:00.000Z",
      eventFamily: "vct-americas",
      eventRegion: "americas",
      tournamentLevel: "tier-1",
      seriesFormat: "BO3",
      teamAProviderId: "vlr:team:501",
      teamBProviderId: "vlr:team:502",
    },
    modelVersion: "fixture-model-v1",
    estimatorType: "elo-baseline",
    calibrationMethod: "none",
    sourceFeatureDatasetVersion: "fixture-feature-dataset-v1",
    featureSchemaVersion: "fixture-feature-schema@1.0.0",
    teamAWinProbability: 0.55,
    teamBWinProbability: 0.45,
    predictedWinnerSide: "teamA",
    confidence: 0.1,
    warnings: [],
    predictionGeneratedAt: new Date().toISOString(),
    inferenceDurationMs: 0.4,
    dataProvenance: { sourceFeatureDatasetVersion: "fixture-feature-dataset-v1", featureSchemaVersion: "fixture-feature-schema@1.0.0", generatedFromHistoricalSnapshot: true },
    resultAvailability: { actualResultRevealable: false },
  };
}

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockRuntimePackageAvailable(page: Page) {
  await page.route(READINESS_URL, (route) => fulfillJson(route, runtimePackageAvailableReadinessBody()));
  await page.route(CATALOG_URL, (route) => fulfillJson(route, catalogBody()));
  await page.route(PREDICT_URL, (route) => fulfillJson(route, predictionBody()));
}

async function mockRuntimePackageMissing(page: Page) {
  await page.route(READINESS_URL, (route) => fulfillJson(route, runtimePackageMissingReadinessBody()));
}

test("historical mode works normally when readiness reports sourceMode: runtime-package", async ({ page }) => {
  await mockRuntimePackageAvailable(page);
  await page.goto("/prediction-studio");

  const matchesGroup = page.getByRole("group", { name: "Historical matches" });
  await expect(matchesGroup).toBeVisible();
  await page.getByRole("button", { name: /vlr:team:501 vs vlr:team:502/ }).click();

  await expect(page.getByText("Real trained model")).toBeVisible();
  await expect(page.getByText("fixture-model-v1")).toBeVisible();
});

test("a missing runtime package (sourceMode: runtime-package, unavailable) still leaves synthetic scenario mode usable", async ({ page }) => {
  await mockRuntimePackageMissing(page);
  await page.goto("/prediction-studio");

  await expect(page.getByRole("heading", { name: "Historical Model Replay" })).toBeVisible();
  await expect(page.getByText(/not available locally/)).toBeVisible();

  await expect(page.getByRole("group", { name: "Team A region" })).toBeVisible();
  const submit = page.getByRole("button", { name: "Generate Prediction" });
  await expect(submit).toBeDisabled();
});
