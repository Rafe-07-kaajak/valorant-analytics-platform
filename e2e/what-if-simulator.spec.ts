import { expect, test, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * TASK-038 — What-if Simulator. Golden path throughout: Team A → Pacific →
 * Paper Rex, Team B → Americas → G2 Esports, BO3 with Ascent/Haven/Bind,
 * matching prediction-studio.spec.ts and prediction-breakdown.spec.ts.
 *
 * Prediction Studio mode-correction task: `/prediction-studio`'s default mode
 * (wire value "synthetic", labeled "Real Model 2.0") now calls the real
 * `/api/internal/prediction/current` endpoint and drives its What-if
 * Simulator with `REAL_ATTRIBUTE_CONTROLS`/`REAL_SIMULATION_PRESETS` and a
 * pure client-side recompute (`simulateRealModel2`) — never the old
 * synthetic `/api/vct-profile-baseline`/`/api/simulate-prediction` routes,
 * and never the old Aggression/Tempo/Attack Strength attribute set. Network
 * interception throughout, mirroring `e2e/prediction-studio-real-mode.spec.ts`'s
 * own pattern, so this file never depends on the real gitignored
 * TASK-044/045 local artifact/dataset.
 */

const CURRENT_PREDICTION_URL = "**/api/internal/prediction/current";

function realResultBody(overrides: Record<string, unknown> = {}) {
  return {
    mode: "current-real-model",
    requestId: "req-e2e",
    teamAId: "paper-rex",
    teamBId: "g2-esports",
    seriesFormat: "BO3",
    tournamentTier: "international",
    eventRegion: "international",
    modelVersion: "fixture-model-v1",
    estimatorType: "elo-baseline",
    calibrationMethod: "none",
    teamAWinProbability: 0.58,
    teamBWinProbability: 0.42,
    predictedWinnerSide: "teamA",
    confidence: 0.2,
    warnings: [],
    predictionGeneratedAt: new Date().toISOString(),
    inferenceDurationMs: 0.6,
    dataProvenance: {
      sourceFeatureDatasetVersion: "fixture-feature-dataset-v1",
      featureSchemaVersion: "fixture-feature-schema@1.0.0",
      canonicalWindowStartIso: "2025-06-07T12:00:00.000Z",
      modelTrainDateRangeEndIso: "2026-04-24T11:00:00.000Z",
      asOfIso: "2026-07-18T04:00:00.000Z",
      constructedFromRealFeatureData: true,
    },
    teamAConfidence: { teamId: "paper-rex", confidence: "verified", seriesCountInWindow: 30 },
    teamBConfidence: { teamId: "g2-esports", confidence: "verified", seriesCountInWindow: 25 },
    teamAState: {
      teamId: "paper-rex",
      isColdStart: false,
      eloRating: 1550,
      recentFormWinRate: 0.6,
      formTrend: 0.05,
      opponentAdjustedRating: 1500,
      strengthOfSchedule: 1480,
      mapPoolBreadth: 7,
      recentMapWinRate: 0.55,
      avgRoundsWonPerMap: 13,
      avgRoundsLostPerMap: 10,
      daysSinceLastMatch: 5,
      isBackToBack: false,
      priorInternationalAppearances: 3,
      priorMastersChampionsAppearances: 1,
      seriesCountInWindow: 30,
    },
    teamBState: {
      teamId: "g2-esports",
      isColdStart: false,
      eloRating: 1480,
      recentFormWinRate: 0.5,
      formTrend: -0.02,
      opponentAdjustedRating: 1470,
      strengthOfSchedule: 1460,
      mapPoolBreadth: 6,
      recentMapWinRate: 0.5,
      avgRoundsWonPerMap: 12,
      avgRoundsLostPerMap: 11,
      daysSinceLastMatch: 8,
      isBackToBack: false,
      priorInternationalAppearances: 2,
      priorMastersChampionsAppearances: 0,
      seriesCountInWindow: 25,
    },
    contribution: {
      driverLabel: "Elo rating differential",
      driverDifferential: 70,
      uncalibratedProbability: 0.58,
      calibrationAdjustment: 0,
      finalProbability: 0.58,
      isSoleDriver: true,
    },
    supportingContext: [
      { id: "recent-form", label: "Recent Form", favoredSide: "teamA", teamAValue: 0.6, teamBValue: 0.5, description: "Win rate across each team's last 10 real matches. Context only, not a direct input to the currently selected estimator.", isDirectModelInput: false },
      { id: "opponent-adjusted-strength", label: "Opponent-Adjusted Strength", favoredSide: "teamA", teamAValue: 1500, teamBValue: 1470, description: "Average real opponent Elo faced in each team's last 10 matches. Context only, not a direct input to the currently selected estimator.", isDirectModelInput: false },
      { id: "map-pool-breadth", label: "Map Pool Breadth", favoredSide: "teamA", teamAValue: 7, teamBValue: 6, description: "Count of distinct real maps each team has recorded matches on. Context only, not a direct input to the currently selected estimator.", isDirectModelInput: false },
      { id: "schedule-strength", label: "Strength of Schedule", favoredSide: "teamA", teamAValue: 1480, teamBValue: 1460, description: "Average real opponent Elo across each team's entire match history. Context only, not a direct input to the currently selected estimator.", isDirectModelInput: false },
      { id: "activity-rest", label: "Activity & Rest", favoredSide: "teamA", teamAValue: 5, teamBValue: 8, description: "Days since each team's last real match (-1 means no real match history). Context only, not a direct input to the currently selected estimator.", isDirectModelInput: false },
      { id: "competition-experience", label: "Competition Experience", favoredSide: "teamA", teamAValue: 4, teamBValue: 2, description: "Combined real prior International/Masters/Champions roster appearances. Context only, not a direct input to the currently selected estimator.", isDirectModelInput: false },
    ],
    evidenceTrust: {
      score: 78,
      explanation: "30 real series for team A and 25 for team B in the canonical data window. 2 prior real meeting(s) between these exact teams.",
      teamASeriesCount: 30,
      teamBSeriesCount: 25,
      teamAIdentityConfidence: "verified",
      teamBIdentityConfidence: "verified",
      h2hMeetingCount: 2,
    },
    headToHead: { priorMeetingCount: 2, teamAWins: 1, teamBWins: 1, teamAWinRate: 0.5, priorMapDifferential: 0, meetingsLast365Days: 2 },
    mapEvidence: {
      teamAMapPoolBreadth: 7,
      teamBMapPoolBreadth: 6,
      teamARecentMapWinRate: 0.55,
      teamBRecentMapWinRate: 0.5,
      teamACumulativeMapWinRate: 0.52,
      teamBCumulativeMapWinRate: 0.48,
      teamAAvgRoundsWonPerMap: 13,
      teamBAvgRoundsWonPerMap: 12,
      teamAAvgRoundsLostPerMap: 10,
      teamBAvgRoundsLostPerMap: 11,
      knownMapPoolOverlapCount: 5,
      mapStrengthDifferential: 0.04,
      evidenceLevel: "sufficient",
    },
    pipeline: [
      { id: "match-request", label: "Match Request", description: "Received the selected teams, series format, and tournament tier.", durationMs: null },
      { id: "run-estimator", label: "Run Selected Estimator", description: "Scored the encoded row with the currently selected estimator.", durationMs: 0.6 },
      { id: "generate-explanation", label: "Generate Human-Readable Explanation", description: "Built the deterministic explanation from the estimator's actual driver and supporting real context.", durationMs: null },
    ],
    ...overrides,
  };
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function selectTeam(page: Page, side: "A" | "B", region: string, team: string) {
  const regionGroup = page.getByRole("group", { name: `Team ${side} region` });
  await regionGroup.getByRole("button", { name: new RegExp(region) }).click();

  const teamGroup = page.getByRole("group", { name: `Team ${side} team` });
  await teamGroup.getByRole("button", { name: new RegExp(team) }).click();
}

async function generatePrediction(page: Page) {
  await page.route(CURRENT_PREDICTION_URL, (route) => fulfillJson(route, realResultBody()));
  await page.goto("/prediction-studio");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  await page.getByRole("button", { name: "Ascent" }).click();
  await page.getByRole("button", { name: "Haven" }).click();
  await page.getByRole("button", { name: "Bind" }).click();
  await page.getByRole("button", { name: "Generate Prediction" }).click();

  await expect(page.getByText("Predicted Winner")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "What-if Simulator" })).toBeVisible({ timeout: 15_000 });
  // Lets the one-time (now synchronous, real-data-derived) baseline resolve so Controls tab sliders are present.
  await expect(page.getByRole("tablist", { name: "What-if simulator views" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("slider", { name: /Paper Rex Elo Strength/ })).toBeVisible({ timeout: 15_000 });
}

test("the simulator appears after a prediction, with the baseline result still visible", async ({ page }) => {
  await generatePrediction(page);

  await expect(page.getByText("Predicted Winner")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Controls" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Result Comparison" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Change Breakdown" })).toBeVisible();
});

test("adjusting Elo Strength and Recent Form updates the draft summary and calls no network endpoint until Run Simulation", async ({
  page,
}) => {
  const simulationRequests: string[] = [];
  const predictionRequests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/simulate-prediction")) simulationRequests.push(req.url());
    if (req.url().includes("/api/internal/prediction/current")) predictionRequests.push(req.url());
  });

  await generatePrediction(page);
  predictionRequests.length = 0; // Drop the initial submission's own request from this count.

  const eloSlider = page.getByRole("slider", { name: /Paper Rex Elo Strength/ });
  await eloSlider.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");

  const recentFormSlider = page.getByRole("slider", { name: /Paper Rex Recent Form/ });
  await recentFormSlider.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");

  await expect(page.getByText(/Paper Rex:.*Elo Strength \+3.*Recent Form \+2/)).toBeVisible();
  expect(simulationRequests).toHaveLength(0);
  expect(predictionRequests).toHaveLength(0);
});

test("Run Simulation recomputes entirely client-side: one request total, never the synthetic simulate route", async ({ page }) => {
  const simulationRequests: string[] = [];
  const predictionRequests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/simulate-prediction")) simulationRequests.push(req.url());
    if (req.url().includes("/api/internal/prediction/current")) predictionRequests.push(req.url());
  });

  await generatePrediction(page);
  expect(predictionRequests).toHaveLength(1); // Only the initial submission.

  const eloSlider = page.getByRole("slider", { name: /Paper Rex Elo Strength/ });
  await eloSlider.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");

  const runButton = page.getByRole("button", { name: "Run Simulation" });
  await expect(runButton).toBeEnabled();
  await runButton.click();
  await expect(runButton).toBeEnabled({ timeout: 15_000 });

  expect(simulationRequests).toHaveLength(0);
  expect(predictionRequests).toHaveLength(1); // Still just the one, from before any simulation.

  await page.getByRole("tab", { name: "Result Comparison" }).click();
  await expect(page.getByText(/Baseline win probability/).first()).toBeVisible();
  await expect(page.getByText(/Simulated win probability/).first()).toBeVisible();

  await page.getByRole("tab", { name: "Change Breakdown" }).click();
  await expect(page.getByText("Applied adjustments")).toBeVisible();
});

test("Reset All returns every control to zero and the safe empty-state summary", async ({ page }) => {
  await generatePrediction(page);

  const eloSlider = page.getByRole("slider", { name: /Paper Rex Elo Strength/ });
  await eloSlider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText(/Paper Rex: Elo Strength \+1/)).toBeVisible();

  await page.getByRole("button", { name: "Reset All" }).click();
  await expect(page.getByText("No hypothetical adjustments applied.")).toBeVisible();
  await expect(eloSlider).toHaveAttribute("value", "0");
});

test("applying a preset sets its documented deltas for that team only", async ({ page }) => {
  await generatePrediction(page);

  await page.getByRole("button", { name: /Apply Elo Swing preset to Paper Rex/ }).click();
  await expect(page.getByText(/Paper Rex:.*Elo Strength \+10/)).toBeVisible();
  expect(await page.getByText(/G2 Esports:/).count()).toBe(0);
});

test("a full keyboard-only flow: slider adjustment, tab switch, and Run Simulation", async ({ page }) => {
  await generatePrediction(page);

  const eloSlider = page.getByRole("slider", { name: /Paper Rex Elo Strength/ });
  await eloSlider.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");

  const controlsTab = page.getByRole("tab", { name: "Controls" });
  await controlsTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Result Comparison" })).toHaveAttribute("aria-selected", "true");

  await page.getByRole("tab", { name: "Controls" }).click();
  const runButton = page.getByRole("button", { name: "Run Simulation" });
  await runButton.focus();
  await page.keyboard.press("Enter");
  await expect(runButton).toBeEnabled({ timeout: 15_000 });
});

test("mobile layout renders the simulator without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await generatePrediction(page);

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

  await page.getByRole("tab", { name: "Result Comparison" }).click();
  const scrollWidthAfter = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidthAfter).toBeLessThanOrEqual(clientWidth + 1);
});

test("the page is accessible with the simulator rendered", async ({ page }) => {
  await generatePrediction(page);
  await page.waitForTimeout(400);

  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("no console errors or failed asset/network requests while using the simulator", async ({ page }) => {
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("requestfailed", (req) => {
    // TASK-039's cross-feature <Link> elements prefetch their RSC payload as
    // the href changes with selection; a stale prefetch is intentionally
    // cancelled (net::ERR_ABORTED) once a newer one supersedes it — not a
    // real network failure.
    if (req.failure()?.errorText === "net::ERR_ABORTED") return;
    failedRequests.push(req.url());
  });
  page.on("response", (res) => {
    if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`);
  });

  await generatePrediction(page);
  const eloSlider = page.getByRole("slider", { name: /Paper Rex Elo Strength/ });
  await eloSlider.focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Run Simulation" }).click();
  await expect(page.getByRole("button", { name: "Run Simulation" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("tab", { name: "Change Breakdown" }).click();

  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
