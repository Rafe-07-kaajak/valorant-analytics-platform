import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("submit button is disabled until a valid scenario is built", async ({ page }) => {
  await page.goto("/prediction-studio");
  const submit = page.getByRole("button", { name: "Generate Prediction" });
  await expect(submit).toBeDisabled();

  await page.locator("select").nth(0).selectOption("sen");
  await page.locator("select").nth(1).selectOption("loud");
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

test("full scenario submission renders an explainable result with no accessibility violations", async ({
  page,
}) => {
  await page.goto("/prediction-studio");

  await page.locator("select").nth(0).selectOption("sen");
  await page.locator("select").nth(1).selectOption("loud");
  await page.getByRole("button", { name: "Ascent" }).click();
  await page.getByRole("button", { name: "Haven" }).click();
  await page.getByRole("button", { name: "Bind" }).click();
  await page.getByRole("button", { name: "Generate Prediction" }).click();

  await expect(page.getByText("Predicted Winner")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Match DNA" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How This Prediction Was Made" })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("full scenario submission works and is accessible in dark mode", async ({ page }) => {
  await page.goto("/prediction-studio");
  await page.getByRole("button", { name: "Toggle color theme" }).click();

  await page.locator("select").nth(0).selectOption("sen");
  await page.locator("select").nth(1).selectOption("loud");
  await page.getByRole("button", { name: "Ascent" }).click();
  await page.getByRole("button", { name: "Haven" }).click();
  await page.getByRole("button", { name: "Bind" }).click();
  await page.getByRole("button", { name: "Generate Prediction" }).click();

  await expect(page.getByText("Predicted Winner")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
