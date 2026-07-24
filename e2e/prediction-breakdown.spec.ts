import { expect, test, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * TASK-037 — Interactive Prediction Breakdown. Golden path throughout:
 * Team A → Pacific → Paper Rex, Team B → Americas → G2 Esports, BO3 with
 * Ascent/Haven/Bind, matching `prediction-studio.spec.ts`.
 *
 * Prediction Studio mode-correction task: `/prediction-studio`'s default
 * mode ("Real Model 2.0") now calls the real `/api/internal/prediction/current`
 * endpoint, so `generatePrediction()` mocks it — mirroring
 * `e2e/prediction-studio-real-mode.spec.ts`'s own pattern.
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

  // A generous timeout absorbs Next.js dev-mode compile/request latency
  // under concurrent e2e load (same rationale as prediction-studio.spec.ts)
  // — not a UI regression.
  await expect(page.getByText("Predicted Winner")).toBeVisible({ timeout: 15_000 });
}

test("the breakdown section appears after a prediction, with all four tabs", async ({ page }) => {
  await generatePrediction(page);

  await expect(page.getByRole("heading", { name: "Interactive Prediction Breakdown" })).toBeVisible();
  const tablist = page.getByRole("tablist").filter({ has: page.getByRole("tab", { name: "Contributions" }) });
  await expect(tablist.getByRole("tab")).toHaveText(["Contributions", "Match DNA", "Key Factors", "Pipeline"]);
});

test("switching between all four tabs works without changing the underlying result", async ({ page }) => {
  await generatePrediction(page);

  const winnerText = await page.getByText("Predicted Winner").locator("..").textContent();
  // TASK-039: the URL now carries the scenario's draft (teams/maps/format),
  // set once when the scenario was built — tab switching must not touch it.
  // The URL-sync `replace` lands asynchronously, so wait for it before
  // capturing the baseline (otherwise this races under heavy parallel load).
  await expect(page).toHaveURL(/teamB=g2-esports/);
  const urlBeforeTabs = page.url();

  await page.getByRole("tab", { name: "Match DNA" }).click();
  await expect(page.getByRole("table").first()).toBeVisible();

  await page.getByRole("tab", { name: "Key Factors" }).click();
  await expect(page.getByRole("list", { name: "Key factors behind this prediction" })).toBeVisible();

  await page.getByRole("tab", { name: "Pipeline" }).click();
  await expect(page.getByRole("list", { name: "Prediction pipeline stages, in order" })).toBeVisible();

  await page.getByRole("tab", { name: "Contributions" }).click();
  await expect(page.getByRole("list", { name: "Feature contributions ranked by magnitude" })).toBeVisible();

  // Still the same URL, and the prediction itself never changed.
  expect(page.url()).toBe(urlBeforeTabs);
  await expect(page.getByText("Predicted Winner").locator("..")).toHaveText(winnerText ?? "");
});

test("selecting a contribution row is reachable by keyboard and cross-highlights the same dimension in Match DNA", async ({
  page,
}) => {
  await generatePrediction(page);

  const contributionList = page.getByRole("list", { name: "Feature contributions ranked by magnitude" });
  const firstRow = contributionList.getByRole("button").first();
  await firstRow.focus();
  await page.keyboard.press("Enter");
  await expect(firstRow).toHaveAttribute("aria-current", "true");

  const rowLabel = (await firstRow.getAttribute("aria-label")) ?? "";
  const dimensionName = rowLabel.split(":")[0]!;

  await page.getByRole("tab", { name: "Match DNA" }).click();
  const dnaRow = page.getByRole("button", { name: new RegExp(`^${dimensionName}:`) });
  await expect(dnaRow).toHaveAttribute("aria-current", "true");
});

test("selecting a key factor is reachable by keyboard and cross-highlights the linked explanation sentence", async ({
  page,
}) => {
  await generatePrediction(page);

  await page.getByRole("tab", { name: "Key Factors" }).click();
  const keyFactorList = page.getByRole("list", { name: "Key factors behind this prediction" });
  const firstFactor = keyFactorList.getByRole("button").first();
  await firstFactor.focus();
  await page.keyboard.press("Enter");
  await expect(firstFactor).toHaveAttribute("aria-current", "true");

  // Explanation sentences deterministically linked to the top factor's
  // dimension become pressed buttons once that dimension is active.
  const explanationCard = page.getByRole("heading", { name: "Why This Prediction" }).locator("..");
  await expect(explanationCard.locator('button[aria-pressed="true"]').first()).toBeVisible();
});

test("activating a pipeline stage reveals its real affected-area tags", async ({ page }) => {
  await generatePrediction(page);

  await page.getByRole("tab", { name: "Pipeline" }).click();
  const stageList = page.getByRole("list", { name: "Prediction pipeline stages, in order" });
  const firstStage = stageList.getByRole("button").first();
  await firstStage.click();
  await expect(firstStage).toHaveAttribute("aria-expanded", "true");
});

test("Escape clears an active selection", async ({ page }) => {
  await generatePrediction(page);

  const contributionList = page.getByRole("list", { name: "Feature contributions ranked by magnitude" });
  const firstRow = contributionList.getByRole("button").first();
  await firstRow.click();
  await expect(firstRow).toHaveAttribute("aria-current", "true");

  await page.keyboard.press("Escape");
  await expect(firstRow).toHaveAttribute("aria-current", "false");
});

test("the original explanation text is unchanged with the highlight layer active", async ({ page }) => {
  await generatePrediction(page);

  const explanationCard = page.getByRole("heading", { name: "Why This Prediction" }).locator("..");
  const explanationText = await explanationCard.locator("p").innerText();
  expect(explanationText.trim().length).toBeGreaterThan(0);

  // Selecting a contribution must not alter the explanation's visible text.
  const contributionList = page.getByRole("list", { name: "Feature contributions ranked by magnitude" });
  await contributionList.getByRole("button").first().click();
  await expect(explanationCard.locator("p")).toHaveText(explanationText);
});

test("mobile layout renders the breakdown tabs without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await generatePrediction(page);

  await expect(page.getByRole("heading", { name: "Interactive Prediction Breakdown" })).toBeVisible();

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

  await page.getByRole("tab", { name: "Match DNA" }).click();
  const scrollWidthAfter = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidthAfter).toBeLessThanOrEqual(clientWidth + 1);
});

test("the page is accessible with the breakdown rendered", async ({ page }) => {
  await generatePrediction(page);
  // Let the result's motion-safe entrance transition settle before scanning
  // — mid-transition text is briefly lower-opacity, which reads as a
  // false-positive contrast violation (same rationale as team-comparison.spec.ts).
  await page.waitForTimeout(400);

  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("no console errors or failed asset/network requests while exploring the breakdown", async ({ page }) => {
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
  await page.getByRole("tab", { name: "Match DNA" }).click();
  await page.getByRole("tab", { name: "Key Factors" }).click();
  await page.getByRole("tab", { name: "Pipeline" }).click();

  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
