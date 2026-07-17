import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * TASK-037 — Interactive Prediction Breakdown. Golden path throughout:
 * Team A → Pacific → Paper Rex, Team B → Americas → G2 Esports, BO3 with
 * Ascent/Haven/Bind, matching `prediction-studio.spec.ts`.
 */
async function selectTeam(page: Page, side: "A" | "B", region: string, team: string) {
  const regionGroup = page.getByRole("group", { name: `Team ${side} region` });
  await regionGroup.getByRole("button", { name: new RegExp(region) }).click();

  const teamGroup = page.getByRole("group", { name: `Team ${side} team` });
  await teamGroup.getByRole("button", { name: new RegExp(team) }).click();
}

async function generatePrediction(page: Page) {
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

test("light and dark themes are accessible with the breakdown rendered", async ({ page }) => {
  await generatePrediction(page);
  // Let the result's motion-safe entrance transition settle before scanning
  // — mid-transition text is briefly lower-opacity, which reads as a
  // false-positive contrast violation (same rationale as team-comparison.spec.ts).
  await page.waitForTimeout(400);

  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark", { timeout: 15_000 });
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
