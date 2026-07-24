import { expect, test, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * TASK-032 golden path: region-first selection over the 32-team VCT roster,
 * replacing the old native-<select> team pickers. Team A → Pacific → Paper
 * Rex, Team B → Americas → G2 Esports is used throughout as the canonical
 * example scenario.
 *
 * Prediction Studio mode-correction task: this file covers "Real Model 2.0"
 * (the default mode, wire value "synthetic") — the former Synthetic Scenario
 * UI, now backed end to end by the real ingested-data pipeline via
 * `/api/internal/prediction/current`. Every test that submits a prediction
 * mocks that endpoint, mirroring `e2e/prediction-studio-real-mode.spec.ts`'s
 * own pattern, so this file never depends on the real gitignored
 * TASK-044/045 local artifact/dataset. "Real Model 1.0" (the distinct
 * technical result experience) is covered by
 * `e2e/prediction-studio-real-mode.spec.ts`.
 */
/**
 * Real Tab-key navigation (rather than a programmatic `.focus()` call)
 * reliably produces browser `:focus-visible` state, which Radix Tooltip's
 * focus-triggered open depends on — a chain of real clicks immediately
 * before a purely-programmatic focus call can leave the browser's
 * interaction-modality heuristic in a state where `:focus-visible` doesn't
 * apply, so no amount of waiting afterward opens the tooltip.
 */
async function tabToLocator(page: Page, locator: import("@playwright/test").Locator, maxPresses = 30) {
  for (let i = 0; i < maxPresses; i++) {
    if (await locator.evaluate((el) => document.activeElement === el).catch(() => false)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("tabToLocator: target was not reached within maxPresses");
}

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

test("submit button is disabled until a valid scenario is built", async ({ page }) => {
  await page.goto("/prediction-studio");
  const submit = page.getByRole("button", { name: "Generate Prediction" });
  await expect(submit).toBeDisabled();

  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  await expect(submit).toBeDisabled(); // no maps selected yet

  await page.getByRole("button", { name: "Ascent" }).click();
  await expect(submit).toBeEnabled();
});

test("BO3 caps the map pool at 3 and disables the rest", async ({ page }) => {
  await page.goto("/prediction-studio");

  for (const map of ["Ascent", "Haven", "Bind"]) {
    await page.getByRole("button", { name: map, exact: true }).click();
  }

  await expect(page.getByRole("button", { name: "Lotus" })).toBeDisabled();
  await expect(page.getByText("Map Pool (3/3)")).toBeVisible();
});

test("shows the Real Model 2.0 disclosure near the scenario controls, never the old synthetic copy", async ({ page }) => {
  await page.goto("/prediction-studio");
  await expect(page.getByText(/real curated historical VCT match data/)).toBeVisible();
  await expect(page.getByText(/simulated team profiles/i)).toHaveCount(0);
});

test("never calls the synthetic prediction, profile-baseline, or simulation APIs", async ({ page }) => {
  const syntheticRequests: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("/api/vct-prediction") || url.includes("/api/vct-profile-baseline") || url.includes("/api/simulate-prediction")) {
      syntheticRequests.push(url);
    }
  });
  await page.route(CURRENT_PREDICTION_URL, (route) => fulfillJson(route, realResultBody()));

  await page.goto("/prediction-studio");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  await page.getByRole("button", { name: "Ascent" }).click();
  await page.getByRole("button", { name: "Haven" }).click();
  await page.getByRole("button", { name: "Bind" }).click();
  await page.getByRole("button", { name: "Generate Prediction" }).click();

  await expect(page.getByText("Predicted Winner")).toBeVisible({ timeout: 15_000 });
  expect(syntheticRequests).toEqual([]);
});

test("prevents the same team from being selected on both sides", async ({ page }) => {
  await page.goto("/prediction-studio");

  await selectTeam(page, "A", "Pacific", "Paper Rex");

  const regionBGroup = page.getByRole("group", { name: "Team B region" });
  await regionBGroup.getByRole("button", { name: /Pacific/ }).click();
  const teamBGroup = page.getByRole("group", { name: "Team B team" });
  const paperRexOnSideB = teamBGroup.getByRole("button", { name: /Paper Rex/ });

  await expect(paperRexOnSideB).toHaveAttribute("aria-disabled", "true");
  await paperRexOnSideB.click({ force: true });
  await expect(paperRexOnSideB).toHaveAttribute("aria-pressed", "false");

  // Selecting a different Team B team still works.
  await teamBGroup.getByRole("button", { name: /T1/ }).click();
  await expect(teamBGroup.getByRole("button", { name: /T1/ })).toHaveAttribute("aria-pressed", "true");
});

test("full scenario submission renders an explainable result with no accessibility violations", async ({
  page,
}) => {
  await page.route(CURRENT_PREDICTION_URL, (route) => fulfillJson(route, realResultBody()));
  await page.goto("/prediction-studio");

  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  await page.getByRole("button", { name: "Ascent" }).click();
  await page.getByRole("button", { name: "Haven" }).click();
  await page.getByRole("button", { name: "Bind" }).click();
  await page.getByRole("button", { name: "Generate Prediction" }).click();

  // A generous timeout absorbs Next.js dev-mode compile/request latency
  // under concurrent e2e load (same rationale as landing.spec.ts's
  // navigation timeouts) — not a UI regression.
  await expect(page.getByText("Predicted Winner")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Match DNA" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How This Prediction Was Made" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Feature Contribution" })).toBeVisible();
  // Visible near the controls, still the truthful Real Model 2.0 copy once a prediction exists.
  await expect(page.getByText(/real curated historical VCT match data/).first()).toBeVisible();

  // Let the result's and What-if Simulator's motion-safe entrance transition
  // settle before scanning — mid-transition text is briefly lower-opacity,
  // which reads as a false-positive contrast violation (same rationale as
  // team-comparison.spec.ts and prediction-breakdown.spec.ts's axe checks).
  await page.waitForTimeout(400);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("confidence and trust score explanations are reachable by keyboard and dismissible via Escape", async ({
  page,
}) => {
  await page.route(CURRENT_PREDICTION_URL, (route) => fulfillJson(route, realResultBody()));
  await page.goto("/prediction-studio");

  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  await page.getByRole("button", { name: "Ascent" }).click();
  await page.getByRole("button", { name: "Haven" }).click();
  await page.getByRole("button", { name: "Bind" }).click();
  await page.getByRole("button", { name: "Generate Prediction" }).click();

  // A generous timeout absorbs Next.js dev-mode compile/request latency
  // under concurrent e2e load (same rationale as landing.spec.ts's
  // navigation timeouts) — not a UI regression.
  await expect(page.getByText("Predicted Winner")).toBeVisible({ timeout: 15_000 });

  const confidenceInfo = page.getByRole("button", { name: "What does Confidence mean?" });
  await confidenceInfo.scrollIntoViewIfNeeded();
  await tabToLocator(page, confidenceInfo);
  // Real Model 2.0's confidence copy (from `presentationAdapter.ts`'s
  // `confidence-explanation` insight) differs from the old synthetic
  // engine's "Confidence sits at..." phrasing — this is the real, honest
  // explanation, not a regression.
  await expect(page.getByRole("tooltip")).toContainText("reflects the calibrated probability margin");

  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toBeHidden();

  const trustScoreInfo = page.getByRole("button", { name: "What does Trust Score mean?" });
  await trustScoreInfo.scrollIntoViewIfNeeded();
  await tabToLocator(page, trustScoreInfo);
  // Real Model 2.0's trust-score copy (from `presentationAdapter.ts`'s
  // `trust-score-explanation` insight) is `${score}/100. ${explanation}`,
  // not the old synthetic "Trust Score sits at..." phrasing.
  await expect(page.getByRole("tooltip")).toContainText("/100.");
});

test("full scenario submission works using only the keyboard", async ({ page }) => {
  await page.route(CURRENT_PREDICTION_URL, (route) => fulfillJson(route, realResultBody()));
  await page.goto("/prediction-studio");

  // Region and team cards are real <button> elements — focusing one directly
  // (as the existing map-pool test already does for its own buttons) and
  // pressing Enter exercises the same native activation a Tab-reached
  // keyboard user gets, without re-simulating the full page tab order.
  const regionAGroup = page.getByRole("group", { name: "Team A region" });
  const pacificA = regionAGroup.getByRole("button", { name: /Pacific/ });
  await pacificA.focus();
  await page.keyboard.press("Enter");

  const teamAGroup = page.getByRole("group", { name: "Team A team" });
  const paperRex = teamAGroup.getByRole("button", { name: /Paper Rex/ });
  await paperRex.focus();
  await page.keyboard.press("Enter");

  const regionBGroup = page.getByRole("group", { name: "Team B region" });
  const americasB = regionBGroup.getByRole("button", { name: /Americas/ });
  await americasB.focus();
  await page.keyboard.press("Space");

  const teamBGroup = page.getByRole("group", { name: "Team B team" });
  const g2 = teamBGroup.getByRole("button", { name: /G2 Esports/ });
  await g2.focus();
  await page.keyboard.press("Space");

  const ascent = page.getByRole("button", { name: "Ascent", exact: true });
  await ascent.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");

  await expect(page.getByText("Map Pool (3/3)")).toBeVisible();

  const submit = page.getByRole("button", { name: "Generate Prediction" });
  await submit.focus();
  await expect(submit).toBeEnabled();
  await page.keyboard.press("Enter");

  // A generous timeout absorbs Next.js dev-mode compile/request latency
  // under concurrent e2e load (same rationale as landing.spec.ts's
  // navigation timeouts) — not a UI regression.
  await expect(page.getByText("Predicted Winner")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Match DNA" })).toBeVisible();
});

test("mobile layout stacks Team A, VS, and Team B without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/prediction-studio");

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");

  await expect(page.getByText("Paper Rex").first()).toBeVisible();
  await expect(page.getByText("G2 Esports").first()).toBeVisible();

  const scrollWidthAfterSelection = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidthAfterSelection).toBeLessThanOrEqual(clientWidth + 1);
});
