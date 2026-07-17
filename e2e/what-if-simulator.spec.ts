import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * TASK-038 — What-if Simulator. Golden path throughout: Team A → Pacific →
 * Paper Rex, Team B → Americas → G2 Esports, BO3 with Ascent/Haven/Bind,
 * matching prediction-studio.spec.ts and prediction-breakdown.spec.ts.
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

  await expect(page.getByText("Predicted Winner")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "What-if Simulator" })).toBeVisible({ timeout: 15_000 });
  // Lets the one-time baseline-profile fetch resolve so Controls tab sliders are present.
  await expect(page.getByRole("tablist", { name: "What-if simulator views" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("slider", { name: /Paper Rex Aggression/ })).toBeVisible({ timeout: 15_000 });
}

test("the simulator appears after a prediction, with the baseline result still visible", async ({ page }) => {
  await generatePrediction(page);

  await expect(page.getByText("Predicted Winner")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Controls" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Result Comparison" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Change Breakdown" })).toBeVisible();
});

test("adjusting attack strength and tempo updates the draft summary and sends no request until Run Simulation", async ({
  page,
}) => {
  const simulationRequests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/simulate-prediction")) simulationRequests.push(req.url());
  });

  await generatePrediction(page);

  const attackSlider = page.getByRole("slider", { name: /Paper Rex Attack Strength/ });
  await attackSlider.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");

  const tempoSlider = page.getByRole("slider", { name: /Paper Rex Tempo/ });
  await tempoSlider.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");

  await expect(page.getByText(/Paper Rex:.*Attack Strength \+3.*Tempo \+2/)).toBeVisible();
  expect(simulationRequests).toHaveLength(0);
});

test("Run Simulation sends exactly one request and renders the comparison and change breakdown", async ({ page }) => {
  const simulationRequests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/simulate-prediction")) simulationRequests.push(req.url());
  });

  // Dev-mode's local API route can resolve in well under a render tick,
  // making the "Running…" loading state too narrow to reliably observe —
  // a small artificial delay is the standard way to assert a real,
  // fast-resolving loading state without weakening what's being verified.
  await page.route("**/api/simulate-prediction", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });

  await generatePrediction(page);

  const tempoSlider = page.getByRole("slider", { name: /Paper Rex Tempo/ });
  await tempoSlider.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");

  const runButton = page.getByRole("button", { name: "Run Simulation" });
  await expect(runButton).toBeEnabled();
  await runButton.click();

  await expect(page.getByRole("button", { name: "Running…" })).toBeVisible();
  await expect(runButton).toBeEnabled({ timeout: 15_000 });
  expect(simulationRequests).toHaveLength(1);

  await page.getByRole("tab", { name: "Result Comparison" }).click();
  await expect(page.getByText(/Baseline win probability/).first()).toBeVisible();
  await expect(page.getByText(/Simulated win probability/).first()).toBeVisible();

  await page.getByRole("tab", { name: "Change Breakdown" }).click();
  await expect(page.getByText("Applied adjustments")).toBeVisible();
});

test("Reset All returns every control to zero and the safe empty-state summary", async ({ page }) => {
  await generatePrediction(page);

  const tempoSlider = page.getByRole("slider", { name: /Paper Rex Tempo/ });
  await tempoSlider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText(/Paper Rex: Tempo \+1/)).toBeVisible();

  await page.getByRole("button", { name: "Reset All" }).click();
  await expect(page.getByText("No hypothetical adjustments applied.")).toBeVisible();
  await expect(tempoSlider).toHaveAttribute("value", "0");
});

test("applying a preset sets its documented deltas for that team only", async ({ page }) => {
  await generatePrediction(page);

  await page.getByRole("button", { name: /Apply Balanced Upgrade preset to Paper Rex/ }).click();
  await expect(page.getByText(/Paper Rex:.*Aggression \+3/)).toBeVisible();
  expect(await page.getByText(/G2 Esports:/).count()).toBe(0);
});

test("a full keyboard-only flow: slider adjustment, tab switch, and Run Simulation", async ({ page }) => {
  await generatePrediction(page);

  const tempoSlider = page.getByRole("slider", { name: /Paper Rex Tempo/ });
  await tempoSlider.focus();
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

test("light and dark themes are accessible with the simulator rendered", async ({ page }) => {
  await generatePrediction(page);
  await page.waitForTimeout(400);

  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark", { timeout: 15_000 });
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
  const tempoSlider = page.getByRole("slider", { name: /Paper Rex Tempo/ });
  await tempoSlider.focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Run Simulation" }).click();
  await expect(page.getByRole("button", { name: "Run Simulation" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("tab", { name: "Change Breakdown" }).click();

  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
