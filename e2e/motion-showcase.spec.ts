import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * TASK-051 — minimal, deterministic coverage for the internal motion-system
 * showcase route. Not a full visual regression suite (see docs/39): this
 * confirms the route renders, every primitive's fallback content is present,
 * reduced-motion emulation reaches the final state, and nothing throws a
 * console error. No external network is used anywhere here.
 */

test("motion showcase renders every primitive's accessible content", async ({ page }) => {
  await page.goto("/internal/motion-showcase");

  await expect(page.getByRole("heading", { name: "Motion System Showcase", level: 1 })).toBeVisible();
  await expect(page.getByText("Internal, not indexed, not linked from navigation")).toBeVisible();

  await expect(page.getByRole("heading", { name: "ScrollReveal" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "StaggerGroup" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "ParallaxLayer" })).toBeVisible();
  await expect(
    page.getByText("Every word animates in on its own, and a screen reader still hears this sentence exactly once."),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "ImageMaskReveal" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "CardSpotlight" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "AnimatedGradient" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "MotionNumber" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "StickyStory" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Scene one" })).toBeVisible();
});

test("is not indexed: page-level robots metadata and the sitewide robots.txt both exclude it", async ({
  page,
  request,
}) => {
  await page.goto("/internal/motion-showcase");
  const robotsMeta = page.locator('meta[name="robots"]');
  await expect(robotsMeta).toHaveAttribute("content", /noindex/);

  const robotsTxt = await (await request.get("/robots.txt")).text();
  expect(robotsTxt).toContain("Disallow: /internal");
});

test("is not linked from the primary navigation", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation").first();
  await expect(nav.getByRole("link", { name: /motion/i })).toHaveCount(0);
});

test("randomizing MotionNumber tweens to new, correctly formatted values", async ({ page }) => {
  await page.goto("/internal/motion-showcase");
  const winProbability = page.getByText("Win probability").locator("..").getByLabel(/%$/);
  const before = await winProbability.textContent();

  await page.getByRole("button", { name: "Randomize" }).click();
  await expect(async () => {
    const after = await winProbability.textContent();
    expect(after).not.toBe(before);
    expect(after).toMatch(/^\d+(\.\d+)?%$/);
  }).toPass({ timeout: 3000 });
});

test("reduced-motion emulation shows every primitive's final state immediately", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/internal/motion-showcase");

  // ScrollReveal/StaggerItem content is opacity-driven; scroll it into view
  // (rather than assuming initial-viewport placement, which depends on
  // viewport height) and confirm it settles fully opaque, which under
  // reduced motion should happen essentially immediately rather than over
  // the normal transition duration.
  const revealed = page.getByText("up", { exact: true });
  await revealed.scrollIntoViewIfNeeded();
  await expect(async () => {
    const opacity = await revealed.evaluate((el) => getComputedStyle(el.parentElement ?? el).opacity);
    expect(Number(opacity)).toBeGreaterThan(0.9);
  }).toPass({ timeout: 2000 });

  // StickyStory falls back to the plain stacked list under reduced motion.
  await expect(page.getByText("Scene one")).toBeVisible();
  await expect(page.getByText("Active scene")).toHaveCount(0);
});

test("no console errors or failed requests while scrolling the showcase", async ({ page }) => {
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("requestfailed", (req) => {
    if (req.failure()?.errorText === "net::ERR_ABORTED") return;
    failedRequests.push(req.url());
  });
  page.on("response", (res) => {
    if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`);
  });

  await page.goto("/internal/motion-showcase");
  await page.mouse.wheel(0, 2000);
  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(200);

  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test("the showcase page has no accessibility violations", async ({ page }) => {
  await page.goto("/internal/motion-showcase");
  // Scroll through the whole page first so every ScrollReveal/StaggerGroup
  // section's `whileInView` has actually fired (axe would otherwise catch
  // below-the-fold content mid-fade and misreport a real color-contrast
  // violation for what is only a not-yet-revealed transient state), then
  // let the reveal transitions settle, matching the wait-before-scan
  // convention already used by landing.spec.ts and cursor-effects.spec.ts.
  await page.mouse.wheel(0, 20000);
  await page.waitForTimeout(500);
  await page.mouse.wheel(0, -20000);
  await page.waitForTimeout(200);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
