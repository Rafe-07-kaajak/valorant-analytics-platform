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
        eventName: "Fixture Event",
        eventRegion: "americas",
        tournamentLevel: "tier-1",
        matchStageDisplay: "Group Stage",
        seriesFormat: "BO3",
        teamAProviderId: "vlr:team:501",
        teamBProviderId: "vlr:team:502",
        teamADisplayName: "Fixture Team A",
        teamBDisplayName: "Fixture Team B",
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
      eventName: "Fixture Event",
      eventRegion: "americas",
      tournamentLevel: "tier-1",
      matchStageDisplay: "Group Stage",
      seriesFormat: "BO3",
      teamAProviderId: "vlr:team:501",
      teamBProviderId: "vlr:team:502",
      teamADisplayName: "Fixture Team A",
      teamBDisplayName: "Fixture Team B",
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
    dataProvenance: {
      sourceFeatureDatasetVersion: "fixture-feature-dataset-v1",
      featureSchemaVersion: "fixture-feature-schema@1.0.0",
      generatedFromHistoricalSnapshot: true,
      modelTrainDateRangeEndIso: "2026-04-24T11:00:00.000Z",
      temporalFidelity: "point-in-time",
    },
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
  await page.getByRole("button", { name: /Fixture Team A vs Fixture Team B/ }).click();

  // Exact match: Real Model 2.0's own pre-submission disclosure badge (always
  // present on this page, since Real Model 2.0 is the default mode) also
  // mentions "real trained model" in prose, case-insensitively colliding with
  // this exact historical-replay badge text without `exact: true`.
  await expect(page.getByText("Real trained model", { exact: true })).toBeVisible();
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
