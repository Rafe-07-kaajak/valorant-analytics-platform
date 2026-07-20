import { devices, expect, test } from "@playwright/test";

/**
 * TASK-051 — mobile-viewport behavior for the motion showcase. Separate
 * file because `test.use(devices[...])` forces its own worker and can't
 * live inside a describe block alongside the desktop specs in
 * motion-showcase.spec.ts, same reason e2e/cursor-effects-touch.spec.ts is
 * split from e2e/cursor-effects.spec.ts.
 */
const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["iPhone 13"];
test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

test("StickyStory renders the stacked fallback, not the sticky panel, on a mobile viewport", async ({ page }) => {
  await page.goto("/internal/motion-showcase");
  await expect(page.getByText("Scene one")).toBeVisible();
  await expect(page.getByText("Active scene")).toHaveCount(0);

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
});
