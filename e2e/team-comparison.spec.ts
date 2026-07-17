import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * TASK-035 — Team Comparison Lab. Golden path throughout: Team A → Pacific
 * → Paper Rex, Team B → Americas → G2 Esports.
 */
async function selectTeam(page: import("@playwright/test").Page, side: "A" | "B", region: string, team: string) {
  const regionGroup = page.getByRole("group", { name: `Team ${side} region` });
  await regionGroup.getByRole("button", { name: new RegExp(region) }).click();

  const teamGroup = page.getByRole("group", { name: `Team ${side} team` });
  await teamGroup.getByRole("button", { name: new RegExp(team) }).click();
}

test("direct navigation to /team-comparison renders the page on refresh", async ({ page }) => {
  await page.goto("/team-comparison");
  await expect(page.getByRole("heading", { name: "Team Comparison Lab", level: 1 })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Team Comparison Lab", level: 1 })).toBeVisible();
});

test("nav includes a Comparison Lab entry with correct active state", async ({ page }) => {
  await page.goto("/");
  const navLink = page.getByRole("navigation").getByRole("link", { name: "Comparison Lab" });
  await expect(navLink).toBeVisible();

  await navLink.click();
  await expect(page).toHaveURL(/team-comparison/, { timeout: 15_000 });
  await expect(page.getByRole("navigation").getByRole("link", { name: "Comparison Lab" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("shows an empty state, then a partial state, before both teams are selected", async ({ page }) => {
  await page.goto("/team-comparison");
  await expect(page.getByText(/Select a team for each side to begin/)).toBeVisible();
  await expect(page.getByRole("tablist")).toHaveCount(0);

  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await expect(page.getByText(/Paper Rex is selected for Team A/)).toBeVisible();
  await expect(page.getByRole("tablist")).toHaveCount(0);
});

test("golden path: Overview renders once both teams are selected, and the disclosure is visible", async ({
  page,
}) => {
  await page.goto("/team-comparison");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");

  await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Overall Rating")).toBeVisible();
  await expect(page.getByText(/This comparison uses simulated team profiles/)).toBeVisible();
});

test("switching between Team DNA, Maps, and Factors tabs works without reloading the page", async ({ page }) => {
  await page.goto("/team-comparison");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");

  await page.getByRole("tab", { name: "Team DNA" }).click();
  await expect(page.getByRole("table")).toBeVisible();

  await page.getByRole("tab", { name: "Maps" }).click();
  await expect(page.getByRole("list", { name: "Modeled map strength by map" })).toBeVisible();

  await page.getByRole("tab", { name: "Factors" }).click();
  await expect(page.getByText("Aggression Advantage").first()).toBeVisible();

  // Still the same URL — tab switches never navigate.
  await expect(page).toHaveURL(/team-comparison$/);
});

test("prevents the same team from being selected on both sides", async ({ page }) => {
  await page.goto("/team-comparison");
  await selectTeam(page, "A", "Pacific", "Paper Rex");

  await page.getByRole("group", { name: "Team B region" }).getByRole("button", { name: /Pacific/ }).click();
  const paperRexOnSideB = page.getByRole("group", { name: "Team B team" }).getByRole("button", { name: /Paper Rex/ });
  await expect(paperRexOnSideB).toHaveAttribute("aria-disabled", "true");
});

test("full keyboard-only selection and tab navigation", async ({ page }) => {
  await page.goto("/team-comparison");

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

  const overviewTab = page.getByRole("tab", { name: "Overview" });
  await overviewTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Team DNA" })).toHaveAttribute("aria-selected", "true");
});

test("mobile layout stacks selectors and tabs without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/team-comparison");

  const scrollWidthBefore = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidthBefore).toBeLessThanOrEqual(clientWidth + 1);

  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  await page.getByRole("tab", { name: "Maps" }).click();

  const scrollWidthAfter = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidthAfter).toBeLessThanOrEqual(clientWidth + 1);
});

test("light and dark themes are accessible with a full comparison rendered", async ({ page }) => {
  await page.goto("/team-comparison");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  await expect(page.getByText("Overall Rating")).toBeVisible();
  // Let the comparison result's motion-safe entrance reveal (opacity/
  // transform) finish before scanning — mid-transition text is briefly
  // lower-opacity, which reads as a false-positive contrast violation.
  await page.waitForTimeout(400);

  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark", { timeout: 15_000 });
  await page.waitForTimeout(400);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("no console errors or failed asset/network requests across the golden path", async ({ page }) => {
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("requestfailed", (req) => failedRequests.push(req.url()));
  page.on("response", (res) => {
    if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`);
  });

  await page.goto("/team-comparison");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  await page.getByRole("tab", { name: "Team DNA" }).click();
  await page.getByRole("tab", { name: "Maps" }).click();
  await page.getByRole("tab", { name: "Factors" }).click();

  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
