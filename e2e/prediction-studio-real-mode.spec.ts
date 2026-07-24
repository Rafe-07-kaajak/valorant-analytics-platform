import { expect, test, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Real-model integration task, later renamed by the Prediction Studio
 * mode-correction task — this file covers "Real Model 1.0" (the technical
 * real-data result experience), reached via the "Real Model 1.0" toggle
 * button. "Real Model 2.0" (the former Synthetic Scenario UI, now also real-
 * data-backed) is covered by `e2e/prediction-studio.spec.ts`. Network
 * interception throughout (no dependency on the real gitignored
 * TASK-044/045 local artifact/dataset), mirroring `e2e/historical-replay.spec.ts`'s
 * own pattern.
 */

const CURRENT_PREDICTION_URL = "**/api/internal/prediction/current";

async function selectTeam(page: Page, side: "A" | "B", region: string, team: string) {
  const regionGroup = page.getByRole("group", { name: `Team ${side} region` });
  await regionGroup.getByRole("button", { name: new RegExp(region) }).click();

  const teamGroup = page.getByRole("group", { name: `Team ${side} team` });
  await teamGroup.getByRole("button", { name: new RegExp(team) }).click();
}

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

test("Real Model 2.0 is the default mode, and the toggle switches explicitly to Real Model 1.0", async ({ page }) => {
  await page.goto("/prediction-studio");

  const modeGroup = page.getByRole("group", { name: "Prediction Mode" });
  await expect(modeGroup.getByRole("button", { name: "Real Model 2.0" })).toHaveAttribute("aria-pressed", "true");
  await expect(modeGroup.getByRole("button", { name: "Real Model 1.0" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("group", { name: "Map Pool" })).toBeVisible();

  await modeGroup.getByRole("button", { name: "Real Model 1.0" }).click();
  await expect(modeGroup.getByRole("button", { name: "Real Model 1.0" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "Match Context (assumed)" })).toBeVisible();
});

test("submitting in Real Model 1.0 mode shows its own result, never Real Model 2.0's", async ({ page }) => {
  await page.route(CURRENT_PREDICTION_URL, (route) => fulfillJson(route, realResultBody()));
  await page.goto("/prediction-studio");

  await page.getByRole("group", { name: "Prediction Mode" }).getByRole("button", { name: "Real Model 1.0" }).click();
  // Paper Rex (Pacific) and G2 Esports (Americas) are in different real
  // regions — "Regional Season" (the default tier) is only valid for a
  // same-region pair, so every submitting test here opts into International.
  await page.getByRole("group", { name: "Match Context (assumed)" }).getByRole("button", { name: "International" }).click();
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  await page.getByRole("button", { name: "Generate Prediction" }).click();

  await expect(page.getByText("Real-model prediction")).toBeVisible();
  await expect(page.getByText("Predicted Winner")).toHaveCount(0);
});

test("switching from Real Model 1.0 back to Real Model 2.0 clears the stale Real Model 1.0 result", async ({ page }) => {
  await page.route(CURRENT_PREDICTION_URL, (route) => fulfillJson(route, realResultBody()));
  await page.goto("/prediction-studio");

  await page.getByRole("group", { name: "Prediction Mode" }).getByRole("button", { name: "Real Model 1.0" }).click();
  await page.getByRole("group", { name: "Match Context (assumed)" }).getByRole("button", { name: "International" }).click();
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  await page.getByRole("button", { name: "Generate Prediction" }).click();
  await expect(page.getByText("Real-model prediction")).toBeVisible();

  await page.getByRole("group", { name: "Prediction Mode" }).getByRole("button", { name: "Real Model 2.0" }).click();
  await expect(page.getByText("Real-model prediction")).toHaveCount(0);
  // Team selections persist across the mode switch.
  await expect(page.getByRole("group", { name: "Team A team" }).getByRole("button", { name: /Paper Rex/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("model version, estimator, and full provenance are displayed for a real prediction", async ({ page }) => {
  await page.route(CURRENT_PREDICTION_URL, (route) => fulfillJson(route, realResultBody()));
  await page.goto("/prediction-studio");

  await page.getByRole("group", { name: "Prediction Mode" }).getByRole("button", { name: "Real Model 1.0" }).click();
  // Paper Rex (Pacific) and G2 Esports (Americas) are in different real
  // regions — "Regional Season" (the default tier) is only valid for a
  // same-region pair, so every submitting test here opts into International.
  await page.getByRole("group", { name: "Match Context (assumed)" }).getByRole("button", { name: "International" }).click();
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  await page.getByRole("button", { name: "Generate Prediction" }).click();

  await expect(page.getByText("fixture-model-v1")).toBeVisible();
  await expect(page.getByText("elo-baseline", { exact: true })).toBeVisible();
  await expect(page.getByText("fixture-feature-dataset-v1")).toBeVisible();
});

test("a provisional/limited-data team shows an explicit warning, not a silent default", async ({ page }) => {
  await page.route(CURRENT_PREDICTION_URL, (route) =>
    fulfillJson(
      route,
      realResultBody({
        teamBConfidence: { teamId: "g2-esports", confidence: "provisional", seriesCountInWindow: 2 },
        warnings: ["G2 Esports has limited real match history (2 matches) or an unverified identity mapping: treat this prediction with reduced confidence for that team."],
      }),
    ),
  );
  await page.goto("/prediction-studio");

  await page.getByRole("group", { name: "Prediction Mode" }).getByRole("button", { name: "Real Model 1.0" }).click();
  // Paper Rex (Pacific) and G2 Esports (Americas) are in different real
  // regions — "Regional Season" (the default tier) is only valid for a
  // same-region pair, so every submitting test here opts into International.
  await page.getByRole("group", { name: "Match Context (assumed)" }).getByRole("button", { name: "International" }).click();
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  await page.getByRole("button", { name: "Generate Prediction" }).click();

  await expect(page.getByText(/limited real match history/)).toBeVisible();
  await expect(page.getByText("Provisional data")).toBeVisible();
});

test("an unsupported/failed request shows a labeled error, without crashing the page", async ({ page }) => {
  await page.route(CURRENT_PREDICTION_URL, (route) =>
    fulfillJson(route, { code: "request_invalid", message: "teamAId is not a known VCT team.", retryable: false }, 400),
  );
  await page.goto("/prediction-studio");

  await page.getByRole("group", { name: "Prediction Mode" }).getByRole("button", { name: "Real Model 1.0" }).click();
  // Paper Rex (Pacific) and G2 Esports (Americas) are in different real
  // regions — "Regional Season" (the default tier) is only valid for a
  // same-region pair, so every submitting test here opts into International.
  await page.getByRole("group", { name: "Match Context (assumed)" }).getByRole("button", { name: "International" }).click();
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  await page.getByRole("button", { name: "Generate Prediction" }).click();

  await expect(page.getByText("teamAId is not a known VCT team.")).toBeVisible();
  await expect(page.getByRole("group", { name: "Team A region" })).toBeVisible();
});

test("mode persists in the URL and survives browser back/forward", async ({ page }) => {
  await page.goto("/prediction-studio");
  await page.getByRole("group", { name: "Prediction Mode" }).getByRole("button", { name: "Real Model 1.0" }).click();
  // Paper Rex (Pacific) and G2 Esports (Americas) are in different real
  // regions — "Regional Season" (the default tier) is only valid for a
  // same-region pair, so every submitting test here opts into International.
  await page.getByRole("group", { name: "Match Context (assumed)" }).getByRole("button", { name: "International" }).click();
  await expect(page).toHaveURL(/mode=real/);

  await page.goto("/team-comparison");
  await page.goBack();
  await expect(page).toHaveURL(/prediction-studio/);
  await expect(page).toHaveURL(/mode=real/);
  await expect(page.getByRole("group", { name: "Prediction Mode" }).getByRole("button", { name: "Real Model 1.0" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("mobile layout renders the mode toggle and match context without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/prediction-studio");
  await page.getByRole("group", { name: "Prediction Mode" }).getByRole("button", { name: "Real Model 1.0" }).click();
  // Paper Rex (Pacific) and G2 Esports (Americas) are in different real
  // regions — "Regional Season" (the default tier) is only valid for a
  // same-region pair, so every submitting test here opts into International.
  await page.getByRole("group", { name: "Match Context (assumed)" }).getByRole("button", { name: "International" }).click();

  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
});

test("Real Model 1.0 mode is accessible before and after a result is shown", async ({ page }) => {
  await page.route(CURRENT_PREDICTION_URL, (route) => fulfillJson(route, realResultBody()));
  await page.goto("/prediction-studio");

  await page.getByRole("group", { name: "Prediction Mode" }).getByRole("button", { name: "Real Model 1.0" }).click();
  // Paper Rex (Pacific) and G2 Esports (Americas) are in different real
  // regions — "Regional Season" (the default tier) is only valid for a
  // same-region pair, so every submitting test here opts into International.
  await page.getByRole("group", { name: "Match Context (assumed)" }).getByRole("button", { name: "International" }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  await page.getByRole("button", { name: "Generate Prediction" }).click();
  await expect(page.getByText("Real-model prediction")).toBeVisible();

  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("Real Model 1.0 result has an equivalent for every major Real Model 2.0 analytical section", async ({ page }) => {
  await page.route(CURRENT_PREDICTION_URL, (route) => fulfillJson(route, realResultBody()));
  await page.goto("/prediction-studio");

  await page.getByRole("group", { name: "Prediction Mode" }).getByRole("button", { name: "Real Model 1.0" }).click();
  await page.getByRole("group", { name: "Match Context (assumed)" }).getByRole("button", { name: "International" }).click();
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  await page.getByRole("button", { name: "Generate Prediction" }).click();
  await expect(page.getByText("Real-model prediction")).toBeVisible();

  // Winner hero / probability / confidence / evidence trust.
  await expect(page.getByText("Real Model Favorite")).toBeVisible();
  await expect(page.getByText("Predicted outcome")).toBeVisible();

  // Interactive Prediction Breakdown, all four tabs.
  await expect(page.getByRole("heading", { name: "Real Prediction Breakdown" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Model Contributions" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Team State" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Key Factors" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Real Pipeline" })).toBeVisible();

  // Real Context Simulator (What-if equivalent).
  await expect(page.getByRole("heading", { name: "Real Context Simulator" })).toBeVisible();

  // Real Team State (Team DNA/radar equivalent) + Matchup Profile.
  await expect(page.getByRole("heading", { name: "Real Team State" })).toBeVisible();
  await expect(page.getByText("Matchup Profile Similarity")).toBeVisible();

  // Why This Prediction.
  await expect(page.getByRole("heading", { name: "Why This Prediction" })).toBeVisible();

  // Key Factors / Feature Contribution equivalents (driver vs. supporting context).
  await expect(page.getByRole("heading", { name: "Actual Model Driver" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Supporting Real Context" })).toBeVisible();

  // Advantage/weakness/deciding-factor/confidence/evidence-trust insight cards.
  await expect(page.getByText("Deciding Factor")).toBeVisible();
  await expect(page.getByText("Evidence Trust", { exact: true })).toBeVisible();

  // Map analysis.
  await expect(page.getByRole("heading", { name: "Map Coverage" })).toBeVisible();

  // How This Prediction Was Made.
  await expect(page.getByRole("heading", { name: "How This Prediction Was Made" })).toBeVisible();

  // Cross-feature actions.
  await expect(page.getByRole("link", { name: "Compare Teams" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore Maps" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy Link" })).toBeVisible();
});

test("no console errors or failed asset/network requests across a Real Model golden path", async ({ page }) => {
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("requestfailed", (req) => {
    if (req.failure()?.errorText === "net::ERR_ABORTED") return;
    failedRequests.push(req.url());
  });
  page.on("response", (res) => {
    if (res.status() >= 400 && !res.url().includes("/api/internal/prediction/current")) failedRequests.push(`${res.status()} ${res.url()}`);
  });

  await page.route(CURRENT_PREDICTION_URL, (route) => fulfillJson(route, realResultBody()));
  await page.goto("/prediction-studio");
  await page.getByRole("group", { name: "Prediction Mode" }).getByRole("button", { name: "Real Model 1.0" }).click();
  // Paper Rex (Pacific) and G2 Esports (Americas) are in different real
  // regions — "Regional Season" (the default tier) is only valid for a
  // same-region pair, so every submitting test here opts into International.
  await page.getByRole("group", { name: "Match Context (assumed)" }).getByRole("button", { name: "International" }).click();
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  await page.getByRole("button", { name: "Generate Prediction" }).click();
  await expect(page.getByText("Real-model prediction")).toBeVisible();

  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
