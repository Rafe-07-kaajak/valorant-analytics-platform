import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("landing page loads with no accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Understand professional VALORANT matches",
  );

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("prediction studio preview section renders", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Every prediction comes with its reasoning attached." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Try Prediction Studio" }),
  ).toHaveAttribute("href", "/prediction-studio");
});

test("theme toggle switches and persists across navigation", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Toggle color theme" });

  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.getByRole("link", { name: "Prediction Studio" }).first().click();
  // A generous timeout here absorbs Next.js dev-mode's on-demand route
  // compile, which can take several seconds under concurrent e2e load —
  // not a UI regression, just the dev server warming up a route.
  await expect(page).toHaveURL(/prediction-studio/, { timeout: 15_000 });
  // Same dev-mode latency as above — the new page's bundle needs to finish
  // hydrating before useTheme's effect re-applies data-theme on <html>.
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark", { timeout: 15_000 });
});

test("hero CTA navigates to Prediction Studio", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Open Prediction Studio" }).first().click();
  await expect(page).toHaveURL(/prediction-studio/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Prediction Studio" })).toBeVisible();
});

test("landing page is accessible in dark mode", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark", { timeout: 15_000 });
  // Let hover/theme-driven style recalculation settle under concurrent e2e
  // load before scanning — same rationale as team-comparison.spec.ts and
  // map-matchup.spec.ts's axe checks.
  await page.waitForTimeout(400);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("the hero CTA is keyboard-reachable and shows a visible focus state", async ({ page }) => {
  await page.goto("/");
  const cta = page.getByRole("link", { name: "Open Prediction Studio" }).first();

  await cta.focus();
  await expect(cta).toBeFocused();

  const outlineWidth = await cta.evaluate((el) => getComputedStyle(el).outlineWidth);
  expect(outlineWidth).not.toBe("0px");

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/prediction-studio/, { timeout: 15_000 });
});
