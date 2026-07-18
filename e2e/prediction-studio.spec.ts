import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * TASK-032 golden path: region-first selection over the 32-team VCT roster,
 * replacing the old native-<select> team pickers. Team A → Pacific → Paper
 * Rex, Team B → Americas → G2 Esports is used throughout as the canonical
 * example scenario.
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

test("shows the disclosure text near the scenario controls", async ({ page }) => {
  await page.goto("/prediction-studio");
  await expect(page.getByText(/simulated team profiles/i)).toBeVisible();
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
  // Visible near both the controls (always) and the result (as a warning) once a prediction exists.
  await expect(page.getByText(/simulated team profiles/i).first()).toBeVisible();

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
  await expect(page.getByRole("tooltip")).toContainText("Confidence sits at");

  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toBeHidden();

  const trustScoreInfo = page.getByRole("button", { name: "What does Trust Score mean?" });
  await trustScoreInfo.scrollIntoViewIfNeeded();
  await tabToLocator(page, trustScoreInfo);
  await expect(page.getByRole("tooltip")).toContainText("Trust Score sits at");
});

test("full scenario submission works using only the keyboard", async ({ page }) => {
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

test("full scenario submission works and is accessible in dark mode", async ({ page }) => {
  await page.goto("/prediction-studio");
  await page.getByRole("button", { name: "Toggle color theme" }).click();

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

  // Same rationale as the light-mode scan above.
  await page.waitForTimeout(400);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
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
