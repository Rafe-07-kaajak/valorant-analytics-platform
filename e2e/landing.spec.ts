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

test("theme toggle switches and persists across navigation", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Toggle color theme" });

  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.getByRole("link", { name: "Prediction Studio" }).first().click();
  await expect(page).toHaveURL(/prediction-studio/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("hero CTA navigates to Prediction Studio", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Open Prediction Studio" }).first().click();
  await expect(page).toHaveURL(/prediction-studio/);
  await expect(page.getByRole("heading", { name: "Prediction Studio" })).toBeVisible();
});
