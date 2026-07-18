import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * TASK-034 — cursor-reactive effects (global spotlight, tactical grid
 * parallax, card-local spotlight). Assertions target computed styles and
 * CSS custom properties rather than exact animation-frame timing.
 */

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
  page.on("requestfailed", (req) => failedRequests.push(req.url()));
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

test("landing and prediction studio remain accessible with cursor effects active (light and dark)", async ({
  page,
}) => {
  await page.goto("/");
  await page.mouse.move(300, 300);
  await page.waitForTimeout(100);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark", { timeout: 15_000 });
  await page.mouse.move(500, 200);
  // Wait for the theme-driven color transition to settle before scanning —
  // same rationale as landing.spec.ts, team-comparison.spec.ts, and
  // map-matchup.spec.ts's axe checks. This spec previously only waited
  // 100ms with no confirmation that `data-theme` had actually committed,
  // which is shorter than the Button component's own 160ms color
  // transition (`--duration-fast`) and could catch a mid-transition color
  // under concurrent e2e load, producing an intermittent false-positive
  // contrast violation rather than a real one.
  await page.waitForTimeout(400);
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
