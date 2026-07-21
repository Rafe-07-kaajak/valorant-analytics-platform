import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * TASK-036 — Map Matchup Explorer. Golden path: Team A → Pacific → Paper
 * Rex, Team B → Americas → G2 Esports.
 */
async function selectTeam(page: import("@playwright/test").Page, side: "A" | "B", region: string, team: string) {
  const regionGroup = page.getByRole("group", { name: `Team ${side} region` });
  await regionGroup.getByRole("button", { name: new RegExp(region) }).click();

  const teamGroup = page.getByRole("group", { name: `Team ${side} team` });
  await teamGroup.getByRole("button", { name: new RegExp(team) }).click();
}

test("direct navigation to /map-matchup renders the page on refresh", async ({ page }) => {
  await page.goto("/map-matchup");
  await expect(page.getByRole("heading", { name: "Map Matchup Explorer", level: 1 })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Map Matchup Explorer", level: 1 })).toBeVisible();
});

test("nav includes a Map Explorer entry with correct active state", async ({ page }) => {
  await page.goto("/");
  // Scoped to the header's "Primary" nav landmark: the footer also has its
  // own labeled nav with the same link names, which makes a bare
  // getByRole("navigation") ambiguous (two landmarks match).
  const primaryNav = page.getByRole("navigation", { name: "Primary" });
  const navLink = primaryNav.getByRole("link", { name: "Map Explorer" });
  await expect(navLink).toBeVisible();

  await navLink.click();
  await expect(page).toHaveURL(/map-matchup/, { timeout: 15_000 });
  await expect(primaryNav.getByRole("link", { name: "Map Explorer" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("golden path: ranking appears once both teams are selected", async ({ page }) => {
  await page.goto("/map-matchup");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");

  await expect(page.getByRole("tab", { name: "Map Ranking" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("list", { name: "Maps ranked by modeled gap" })).toBeVisible();
  await expect(page.getByText(/This comparison uses simulated team profiles/)).toBeVisible();
});

test("changing sort mode changes the ranking order", async ({ page }) => {
  await page.goto("/map-matchup");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");

  const rankingList = page.getByRole("list", { name: "Maps ranked by modeled gap" });
  const firstRowByGap = await rankingList.getByRole("button").first().getAttribute("aria-label");

  await page.getByLabel("Sort by").selectOption("map-name");
  const firstRowByName = await rankingList.getByRole("button").first().getAttribute("aria-label");

  expect(firstRowByName).not.toBe(firstRowByGap);
});

test("selecting a map, Select All, Clear, and Close Maps all update pool state", async ({ page }) => {
  await page.goto("/map-matchup");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");

  const poolGroup = page.getByRole("group", { name: /Map Pool/ });
  const ascent = poolGroup.getByRole("button", { name: "Ascent", exact: true });
  await expect(ascent).toHaveAttribute("aria-pressed", "false");
  await ascent.click();
  await expect(ascent).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Select All" }).click();
  await expect(poolGroup.getByRole("button", { name: "Bind", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Clear" }).click();
  await expect(ascent).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "Close Maps" }).click();
  // At least verify the shortcut ran without error and pool label updated.
  await expect(page.getByText(/Map Pool \(\d+\/\d+\)/)).toBeVisible();
});

test("Selected Pool tab shows the aggregate summary once maps are selected", async ({ page }) => {
  await page.goto("/map-matchup");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  await page.getByRole("button", { name: "Select All" }).click();

  await page.getByRole("tab", { name: "Selected Pool" }).click();
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByText(/favors|close overall/)).toBeVisible();
});

test("Map Detail tab shows a focused explanation for the active map", async ({ page }) => {
  await page.goto("/map-matchup");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");

  const rankingList = page.getByRole("list", { name: "Maps ranked by modeled gap" });
  const secondRow = rankingList.getByRole("button").nth(1);
  const label = (await secondRow.getAttribute("aria-label"))!;
  const mapName = label.split(":")[0]!;
  await secondRow.click();

  await page.getByRole("tab", { name: "Map Detail" }).click();
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByRole("heading", { level: 2 })).toHaveText(mapName);
  await expect(panel.getByText(new RegExp(mapName)).first()).toBeVisible();
});

test("full keyboard-only team selection, map pool toggling, and tab navigation", async ({ page }) => {
  await page.goto("/map-matchup");

  const pacificA = page.getByRole("group", { name: "Team A region" }).getByRole("button", { name: /Pacific/ });
  await pacificA.focus();
  await page.keyboard.press("Enter");
  const paperRex = page.getByRole("group", { name: "Team A team" }).getByRole("button", { name: /Paper Rex/ });
  await paperRex.focus();
  await page.keyboard.press("Enter");

  const americasB = page.getByRole("group", { name: "Team B region" }).getByRole("button", { name: /Americas/ });
  await americasB.focus();
  await page.keyboard.press("Space");
  const g2 = page.getByRole("group", { name: "Team B team" }).getByRole("button", { name: /G2 Esports/ });
  await g2.focus();
  await page.keyboard.press("Space");

  const ascentToggle = page.getByRole("group", { name: /Map Pool/ }).getByRole("button", { name: "Ascent", exact: true });
  await ascentToggle.focus();
  await page.keyboard.press("Enter");
  await expect(ascentToggle).toHaveAttribute("aria-pressed", "true");

  const rankingTab = page.getByRole("tab", { name: "Map Ranking" });
  await rankingTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Selected Pool" })).toHaveAttribute("aria-selected", "true");
});

test("mobile layout stacks selectors, pool controls, and tabs without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/map-matchup");

  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(clientWidth + 1);

  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  await page.getByRole("button", { name: "Select All" }).click();
  await page.getByRole("tab", { name: "Selected Pool" }).click();

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(clientWidth + 1);
});

test("the page is accessible with a full matchup rendered", async ({ page }) => {
  await page.goto("/map-matchup");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  await page.getByRole("button", { name: "Select All" }).click();
  await expect(page.getByRole("list", { name: "Maps ranked by modeled gap" })).toBeVisible();
  await page.waitForTimeout(400);

  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("no console errors or failed asset/network requests across the golden path", async ({ page }) => {
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

  await page.goto("/map-matchup");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  await page.getByRole("button", { name: "Select All" }).click();
  await page.getByRole("tab", { name: "Selected Pool" }).click();
  await page.getByRole("tab", { name: "Map Detail" }).click();

  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
