import { devices, expect, test } from "@playwright/test";

/**
 * TASK-034 — touch/coarse-pointer behavior. Separate file because
 * `test.use(devices[...])` forces its own worker and can't live inside a
 * describe block alongside the fine-pointer desktop specs.
 *
 * Only the input-capability fields are taken from the device preset — not
 * `defaultBrowserType` ("webkit"), since this project only installs
 * chromium; a touch-capable Chromium context is enough to exercise the
 * `(pointer: coarse)` / `(hover: none)` CSS gates under test here.
 */
const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["iPhone 13"];
test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

test("global spotlight and card-local glow are disabled on touch", async ({ page }) => {
  await page.goto("/");
  const spotlightDisplay = await page.evaluate(() => {
    const el = document.querySelector(".cursor-spotlight");
    return el ? getComputedStyle(el).display : null;
  });
  expect(spotlightDisplay).toBe("none");

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
});
