import { expect, test, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * TASK-034 — cursor-reactive effects (global spotlight, tactical grid
 * parallax, card-local spotlight). Assertions target computed styles and
 * CSS custom properties rather than exact animation-frame timing.
 *
 * Prediction Studio mode-correction task: `/prediction-studio`'s default
 * mode ("Real Model 2.0") now calls the real `/api/internal/prediction/current`
 * endpoint, so the one test here that submits a prediction mocks it —
 * mirroring `e2e/prediction-studio-real-mode.spec.ts`'s own pattern.
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

test("global spotlight activates on pointer move and deactivates on pointer leave", async ({ page }) => {
  await page.goto("/");
  await page.mouse.move(400, 300);
  await page.waitForTimeout(100);

  await expect(page.locator("html")).toHaveAttribute("data-cursor-active", "true");
  const cursorX = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--cursor-x"),
  );
  expect(cursorX.trim()).toBe("400px");

  await page.mouse.move(0, 0);
  await page.dispatchEvent("html", "mouseleave");
  await expect(page.locator("html")).toHaveAttribute("data-cursor-active", "false");
});

test("the global spotlight layer never intercepts clicks", async ({ page }) => {
  await page.goto("/");
  const cta = page.getByRole("link", { name: "Open Prediction Studio" }).first();
  const box = await cta.boundingBox();
  if (!box) throw new Error("CTA not found");

  // Move across the spotlight's path before clicking, exactly the scenario
  // that would fail if the fixed spotlight layer captured pointer events.
  await page.mouse.move(box.x - 100, box.y - 100);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await cta.click();

  await expect(page).toHaveURL(/prediction-studio/, { timeout: 15_000 });
});

test("card-local spotlight updates on hover and selected state stays visually stronger", async ({ page }) => {
  await page.goto("/prediction-studio");

  const regionCard = page
    .getByRole("group", { name: "Team A region" })
    .getByRole("button", { name: /Pacific/ });
  const box = await regionCard.boundingBox();
  if (!box) throw new Error("region card not found");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(50);

  const spotlightX = await regionCard.evaluate((el) => getComputedStyle(el).getPropertyValue("--spotlight-x"));
  expect(spotlightX.trim()).not.toBe("");

  await regionCard.click();
  await expect(regionCard).toHaveAttribute("aria-pressed", "true");
  const boxShadow = await regionCard.evaluate((el) => getComputedStyle(el).boxShadow);
  // The selected-state ring (box-shadow) is present — a stronger, persistent
  // signal than the hover-only opacity glow, matching the effect hierarchy.
  expect(boxShadow).not.toBe("none");
});

test("disabled team cards never activate a pointer glow", async ({ page }) => {
  await page.goto("/prediction-studio");

  await page.getByRole("group", { name: "Team A region" }).getByRole("button", { name: /Pacific/ }).click();
  await page.getByRole("group", { name: "Team A team" }).getByRole("button", { name: /Paper Rex/ }).click();
  await page.getByRole("group", { name: "Team B region" }).getByRole("button", { name: /Pacific/ }).click();

  const disabledCard = page.getByRole("group", { name: "Team B team" }).getByRole("button", { name: /Paper Rex/ });
  await expect(disabledCard).toHaveAttribute("aria-disabled", "true");
  const className = await disabledCard.getAttribute("class");
  expect(className).not.toContain("pointer-glow");
});

test("no horizontal overflow or console errors while the cursor moves across the landing page", async ({
  page,
}) => {
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("requestfailed", (req) => {
    // Next.js's <Link> prefetches its RSC payload on hover/viewport-entry; a
    // stale prefetch is intentionally cancelled (net::ERR_ABORTED) the
    // moment cursor movement supersedes it with another — not a real
    // network failure. Same exclusion as cross-feature-navigation.spec.ts.
    if (req.failure()?.errorText === "net::ERR_ABORTED") return;
    failedRequests.push(req.url());
  });
  page.on("response", (res) => {
    if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`);
  });

  await page.goto("/");
  for (const [x, y] of [[100, 100], [500, 400], [900, 200], [300, 800]] as const) {
    await page.mouse.move(x, y);
  }
  await page.waitForTimeout(150);

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test("landing and prediction studio remain accessible with cursor effects active", async ({
  page,
}) => {
  await page.goto("/");
  await page.mouse.move(300, 300);
  // The hero's headline/CTA stagger (delayChildren 0.05s + staggerChildren
  // 0.12s across 3 items, each a 0.6s transition) doesn't fully settle
  // until ~0.9s — a 100ms wait here catches the CTA link mid-fade, which
  // reads as a false-positive contrast violation (partial opacity blends
  // its text/background toward a lower-contrast intermediate color).
  await page.waitForTimeout(1000);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.goto("/prediction-studio");
  await page.mouse.move(400, 300);
  await page.waitForTimeout(100);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("keyboard-only navigation still shows focus states with no pointer movement", async ({ page }) => {
  await page.goto("/prediction-studio");

  const pacificA = page
    .getByRole("group", { name: "Team A region" })
    .getByRole("button", { name: /Pacific/ });
  await pacificA.focus();
  await expect(pacificA).toBeFocused();

  const outlineWidth = await pacificA.evaluate((el) => getComputedStyle(el).outlineWidth);
  expect(outlineWidth).not.toBe("0px");

  await page.keyboard.press("Enter");
  await expect(pacificA).toHaveAttribute("aria-pressed", "true");
});

test("reduced motion removes grid parallax and card-local glow transforms", async ({ page }) => {
  await page.route(CURRENT_PREDICTION_URL, (route) => fulfillJson(route, realResultBody()));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/prediction-studio");

  await page.getByRole("group", { name: "Team A region" }).getByRole("button", { name: /Pacific/ }).click();
  await page.getByRole("group", { name: "Team A team" }).getByRole("button", { name: /Paper Rex/ }).click();
  await page.getByRole("group", { name: "Team B region" }).getByRole("button", { name: /Americas/ }).click();
  await page.getByRole("group", { name: "Team B team" }).getByRole("button", { name: /G2 Esports/ }).click();
  await page.getByRole("button", { name: "Ascent" }).click();
  await page.getByRole("button", { name: "Generate Prediction" }).click();
  // A generous timeout absorbs Next.js dev-mode compile/request latency
  // under concurrent e2e load, same as the equivalent guard in landing.spec.ts.
  await expect(page.getByText("Predicted Winner")).toBeVisible({ timeout: 15_000 });

  const grid = page.locator(".tactical-grid-parallax").first();
  await expect(grid).toBeVisible();
  const transform = await grid.evaluate((el) => getComputedStyle(el).transform);
  expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(transform);
});
