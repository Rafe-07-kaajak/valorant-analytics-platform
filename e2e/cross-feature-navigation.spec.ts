import { expect, test, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * TASK-039 — Cross-feature Navigation and State Integration. Golden path
 * throughout: Team A → Pacific → Paper Rex, Team B → Americas → G2 Esports,
 * matching the other feature specs.
 *
 * Prediction Studio mode-correction task: `/prediction-studio`'s default
 * mode ("Real Model 2.0") now calls the real `/api/internal/prediction/current`
 * endpoint, so every test here that submits a prediction mocks it —
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

async function selectTeam(page: Page, side: "A" | "B", region: string, team: string) {
  const regionGroup = page.getByRole("group", { name: `Team ${side} region` });
  await regionGroup.getByRole("button", { name: new RegExp(region) }).click();

  const teamGroup = page.getByRole("group", { name: `Team ${side} team` });
  await teamGroup.getByRole("button", { name: new RegExp(team) }).click();
}

test("a direct Prediction Studio URL initializes the draft without auto-submitting", async ({ page }) => {
  await page.route(CURRENT_PREDICTION_URL, (route) => fulfillJson(route, realResultBody()));
  await page.goto(
    "/prediction-studio?regionA=pacific&teamA=paper-rex&regionB=americas&teamB=g2-esports&maps=ascent,haven,bind&format=BO3",
  );

  // Scoped to each side's team-selector group — Historical Model Replay's
  // archive (on the same page) can also render a team's display name as
  // visible button text, so an unscoped page-wide locator is ambiguous.
  await expect(page.getByRole("group", { name: "Team A team" }).getByRole("button", { name: /Paper Rex/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("group", { name: "Team B team" }).getByRole("button", { name: /G2 Esports/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const seriesFormatGroup = page.getByRole("group", { name: "Series Format" });
  await expect(seriesFormatGroup.getByRole("button", { name: "Best of 3" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Ascent", exact: true })).toHaveAttribute("aria-pressed", "true");

  // No prediction was auto-generated — the user must still press the button.
  await expect(page.getByText("Predicted Winner")).toHaveCount(0);
  const submit = page.getByRole("button", { name: "Generate Prediction" });
  await expect(submit).toBeEnabled();

  await submit.click();
  await expect(page.getByText("Predicted Winner")).toBeVisible({ timeout: 15_000 });
});

test("a direct Team Comparison URL renders the full comparison immediately", async ({ page }) => {
  await page.goto("/team-comparison?regionA=pacific&teamA=paper-rex&regionB=americas&teamB=g2-esports");

  await expect(page.getByRole("tablist", { name: "Comparison views" })).toBeVisible();
  await expect(page.getByText("Overall Rating")).toBeVisible();
});

test("a direct Map Matchup URL renders the selected pool immediately", async ({ page }) => {
  await page.goto(
    "/map-matchup?regionA=pacific&teamA=paper-rex&regionB=americas&teamB=g2-esports&maps=ascent,haven",
  );

  const poolGroup = page.getByRole("group", { name: /Map Pool/ });
  await expect(poolGroup.getByRole("button", { name: "Ascent" })).toHaveAttribute("aria-pressed", "true");
  await expect(poolGroup.getByRole("button", { name: "Haven" })).toHaveAttribute("aria-pressed", "true");
  await expect(poolGroup.getByRole("button", { name: "Bind" })).toHaveAttribute("aria-pressed", "false");
});

test("an invalid region is repaired to the valid team's real region", async ({ page }) => {
  await page.goto("/team-comparison?regionA=emea&teamA=paper-rex");
  const regionGroup = page.getByRole("group", { name: "Team A region" });
  await expect(regionGroup.getByRole("button", { name: /^VCT Pacific$/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /Paper Rex/ })).toHaveAttribute("aria-pressed", "true");
});

test("the same team on both sides is repaired by clearing Team B", async ({ page }) => {
  await page.goto("/team-comparison?teamA=paper-rex&teamB=paper-rex");
  await expect(page.getByText(/Paper Rex is selected for Team A/)).toBeVisible();
  await expect(page.getByRole("tablist")).toHaveCount(0);
});

test("selecting a team updates the URL without a full page reload", async ({ page }) => {
  await page.goto("/team-comparison");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await expect(page).toHaveURL(/regionA=pacific&teamA=paper-rex/);

  await selectTeam(page, "B", "Americas", "G2 Esports");
  await expect(page).toHaveURL(/teamB=g2-esports/);
});

test("cross-feature links preserve both teams from Prediction Studio to Team Comparison Lab and Map Matchup Explorer", async ({
  page,
}) => {
  await page.goto("/prediction-studio");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");

  const compareLink = page.getByRole("link", { name: /Compare Teams/ });
  await expect(compareLink).toHaveAttribute("href", /teamA=paper-rex/);
  await expect(compareLink).toHaveAttribute("href", /teamB=g2-esports/);

  await compareLink.click();
  await expect(page).toHaveURL(/team-comparison/);
  await expect(page.getByText("Overall Rating")).toBeVisible();
});

test("the map pool is preserved when moving from Map Matchup Explorer to Prediction Studio", async ({ page }) => {
  await page.goto("/map-matchup");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");

  const poolGroup = page.getByRole("group", { name: /Map Pool/ });
  await poolGroup.getByRole("button", { name: "Ascent" }).click();
  await poolGroup.getByRole("button", { name: "Haven" }).click();

  const openInStudioLink = page.getByRole("link", { name: /Open in Prediction Studio/ });
  await expect(openInStudioLink).toHaveAttribute("href", /maps=ascent%2Chaven/);

  await openInStudioLink.click();
  await expect(page).toHaveURL(/prediction-studio/);
  await expect(page.getByRole("button", { name: "Ascent", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Haven", exact: true })).toHaveAttribute("aria-pressed", "true");
  // No prediction fires just from navigating here with a pre-filled draft.
  await expect(page.getByText("Predicted Winner")).toHaveCount(0);
});

test("result-level links reflect the generated result and stay stable while the simulator and breakdown are used", async ({
  page,
}) => {
  await page.route(CURRENT_PREDICTION_URL, (route) => fulfillJson(route, realResultBody()));
  await page.goto("/prediction-studio");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  await page.getByRole("button", { name: "Ascent" }).click();
  await page.getByRole("button", { name: "Generate Prediction" }).click();
  await expect(page.getByText("Predicted Winner")).toBeVisible({ timeout: 15_000 });

  const resultLink = page.getByRole("link", { name: /Compare Teams/ });
  const hrefBefore = await resultLink.getAttribute("href");

  // Interact with the What-if Simulator and the breakdown tabs — neither
  // should change the result-level link.
  await expect(page.getByRole("heading", { name: "What-if Simulator" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("tab", { name: "Match DNA" }).click();

  const hrefAfter = await page.getByRole("link", { name: /Compare Teams/ }).getAttribute("href");
  expect(hrefAfter).toBe(hrefBefore);
});

test("browser back/forward restores prior URL-backed selections across a real page navigation", async ({ page }) => {
  // Same-page selection changes use router.replace (by design — see
  // requirement 6, "no flood"), so they intentionally don't each become a
  // separate back-stack entry. What must work is restoring state across an
  // actual page-to-page navigation, which does push a history entry.
  await page.goto("/team-comparison");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  await expect(page.getByText("Overall Rating")).toBeVisible();
  // router.replace() is async — component state (hence "Overall Rating")
  // can be visible a render or two before the URL/history entry it drives
  // actually commits. The history entry this test's later goBack() must
  // land on is exactly this one (replaced in place, never pushed — see the
  // comment above), so the actual query string, not just rendered text,
  // has to be confirmed before navigating away from it. Same reasoning as
  // the "Copy Link" test below. Without this, a fast click here can
  // navigate away before the second replace() lands, so goBack() later
  // restores an earlier (or empty) history state — reproduced as an
  // intermittent, load-sensitive "Paper Rex button not found after
  // goBack()" failure without this wait.
  await expect(page).toHaveURL(/teamA=paper-rex/);
  await expect(page).toHaveURL(/teamB=g2-esports/);

  await page.getByRole("link", { name: /Open in Prediction Studio/ }).click();
  await expect(page).toHaveURL(/prediction-studio/);
  // Scoped to the team-selector group — see the comment on the other
  // occurrence of this pattern above (Historical Model Replay's archive can
  // also render a team's display name as visible button text).
  await expect(page.getByRole("group", { name: "Team A team" }).getByRole("button", { name: /Paper Rex/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // goBack()/goForward() re-render an async Server Component page via a
  // fresh RSC round-trip (these routes have dynamic searchParams, so
  // there's no static cache to serve instead) — measurably heavier than a
  // normal Link click, and observed to occasionally exceed the suite's
  // default timeout only late in a full single-worker run (never in
  // isolation) as the long-lived dev server/browser accumulate load. A
  // longer timeout here is a test-runtime margin, not a functional wait.
  await page.goBack();
  await expect(page).toHaveURL(/team-comparison/, { timeout: 15_000 });
  await expect(page.getByText("Overall Rating")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /Paper Rex/ })).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });

  await page.goForward();
  await expect(page).toHaveURL(/prediction-studio/, { timeout: 15_000 });
  // Scoped to the team-selector group — see the comment on the other
  // occurrence of this pattern above (Historical Model Replay's archive can
  // also render a team's display name as visible button text).
  await expect(page.getByRole("group", { name: "Team B team" }).getByRole("button", { name: /G2 Esports/ })).toHaveAttribute(
    "aria-pressed",
    "true",
    { timeout: 15_000 },
  );
});

test("cross-feature links use normal anchor hrefs, compatible with opening in a new tab", async ({ page }) => {
  await page.goto("/prediction-studio");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");

  const link = page.getByRole("link", { name: /Compare Teams/ });
  expect(await link.getAttribute("href")).toMatch(/^\/team-comparison\?/);
  expect(await link.evaluate((el) => el.tagName)).toBe("A");
});

test("mobile layout renders cross-feature links without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/team-comparison");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");

  await expect(page.getByRole("link", { name: /Open in Prediction Studio/ })).toBeVisible();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
});

test("the page is accessible with cross-feature links rendered", async ({ page }) => {
  await page.goto("/team-comparison");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  await page.waitForTimeout(400);

  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("Copy Link copies the current canonical URL and announces success", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/team-comparison");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  // Wait for the URL sync to actually land before copying it.
  await expect(page).toHaveURL(/teamB=g2-esports/);

  await page.getByRole("button", { name: "Copy Link" }).click();
  await expect(page.getByRole("status")).toHaveText("Link copied");

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("teamA=paper-rex");
  expect(copied).toContain("teamB=g2-esports");
});

test("no console errors or failed asset/network requests across a cross-feature navigation path", async ({ page }) => {
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("requestfailed", (req) => {
    // Next.js's <Link> prefetches its RSC payload as the href changes with
    // every team selection; a stale prefetch is intentionally cancelled
    // (net::ERR_ABORTED) the moment a newer one supersedes it — not a real
    // network failure.
    if (req.failure()?.errorText === "net::ERR_ABORTED") return;
    failedRequests.push(req.url());
  });
  page.on("response", (res) => {
    if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`);
  });

  await page.goto("/prediction-studio");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  await page.getByRole("link", { name: /Explore Maps/ }).click();
  await expect(page).toHaveURL(/map-matchup/);
  await page.getByRole("link", { name: /Open in Prediction Studio/ }).click();
  await expect(page).toHaveURL(/prediction-studio/);

  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
