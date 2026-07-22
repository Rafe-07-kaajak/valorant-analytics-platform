import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * TASK-039 — Cross-feature Navigation and State Integration. Golden path
 * throughout: Team A → Pacific → Paper Rex, Team B → Americas → G2 Esports,
 * matching the other feature specs.
 */
async function selectTeam(page: Page, side: "A" | "B", region: string, team: string) {
  const regionGroup = page.getByRole("group", { name: `Team ${side} region` });
  await regionGroup.getByRole("button", { name: new RegExp(region) }).click();

  const teamGroup = page.getByRole("group", { name: `Team ${side} team` });
  await teamGroup.getByRole("button", { name: new RegExp(team) }).click();
}

test("a direct Prediction Studio URL initializes the draft without auto-submitting", async ({ page }) => {
  await page.goto(
    "/prediction-studio?regionA=pacific&teamA=paper-rex&regionB=americas&teamB=g2-esports&maps=ascent,haven,bind&format=BO3",
  );

  await expect(page.getByRole("button", { name: /Paper Rex/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /G2 Esports/ })).toHaveAttribute("aria-pressed", "true");
  const seriesFormatGroup = page.getByRole("group", { name: "Series Format" });
  await expect(seriesFormatGroup.getByRole("button", { name: "Best of 3" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Ascent", exact: true })).toHaveAttribute("aria-pressed", "true");

  // No prediction was auto-generated — the user must still press the button.
  await expect(page.getByText("Predicted Winner")).toHaveCount(0);
  const submit = page.getByRole("button", { name: "Generate Prediction" });
  await expect(submit).toBeEnabled();

  await submit.click();
  await expect(page.getByText("Predicted Winner")).toBeVisible({ timeout: 15_000 });
});

test("a direct Team Comparison URL renders the full comparison immediately", async ({ page }) => {
  await page.goto("/team-comparison?regionA=pacific&teamA=paper-rex&regionB=americas&teamB=g2-esports");

  await expect(page.getByRole("tablist", { name: "Comparison views" })).toBeVisible();
  await expect(page.getByText("Overall Rating")).toBeVisible();
});

test("a direct Map Matchup URL renders the selected pool immediately", async ({ page }) => {
  await page.goto(
    "/map-matchup?regionA=pacific&teamA=paper-rex&regionB=americas&teamB=g2-esports&maps=ascent,haven",
  );

  const poolGroup = page.getByRole("group", { name: /Map Pool/ });
  await expect(poolGroup.getByRole("button", { name: "Ascent" })).toHaveAttribute("aria-pressed", "true");
  await expect(poolGroup.getByRole("button", { name: "Haven" })).toHaveAttribute("aria-pressed", "true");
  await expect(poolGroup.getByRole("button", { name: "Bind" })).toHaveAttribute("aria-pressed", "false");
});

test("an invalid region is repaired to the valid team's real region", async ({ page }) => {
  await page.goto("/team-comparison?regionA=emea&teamA=paper-rex");
  const regionGroup = page.getByRole("group", { name: "Team A region" });
  await expect(regionGroup.getByRole("button", { name: /^VCT Pacific$/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /Paper Rex/ })).toHaveAttribute("aria-pressed", "true");
});

test("the same team on both sides is repaired by clearing Team B", async ({ page }) => {
  await page.goto("/team-comparison?teamA=paper-rex&teamB=paper-rex");
  await expect(page.getByText(/Paper Rex is selected for Team A/)).toBeVisible();
  await expect(page.getByRole("tablist")).toHaveCount(0);
});

test("selecting a team updates the URL without a full page reload", async ({ page }) => {
  await page.goto("/team-comparison");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await expect(page).toHaveURL(/regionA=pacific&teamA=paper-rex/);

  await selectTeam(page, "B", "Americas", "G2 Esports");
  await expect(page).toHaveURL(/teamB=g2-esports/);
});

test("cross-feature links preserve both teams from Prediction Studio to Team Comparison Lab and Map Matchup Explorer", async ({
  page,
}) => {
  await page.goto("/prediction-studio");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");

  const compareLink = page.getByRole("link", { name: /Compare Teams/ });
  await expect(compareLink).toHaveAttribute("href", /teamA=paper-rex/);
  await expect(compareLink).toHaveAttribute("href", /teamB=g2-esports/);

  await compareLink.click();
  await expect(page).toHaveURL(/team-comparison/);
  await expect(page.getByText("Overall Rating")).toBeVisible();
});

test("the map pool is preserved when moving from Map Matchup Explorer to Prediction Studio", async ({ page }) => {
  await page.goto("/map-matchup");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");

  const poolGroup = page.getByRole("group", { name: /Map Pool/ });
  await poolGroup.getByRole("button", { name: "Ascent" }).click();
  await poolGroup.getByRole("button", { name: "Haven" }).click();

  const openInStudioLink = page.getByRole("link", { name: /Open in Prediction Studio/ });
  await expect(openInStudioLink).toHaveAttribute("href", /maps=ascent%2Chaven/);

  await openInStudioLink.click();
  await expect(page).toHaveURL(/prediction-studio/);
  await expect(page.getByRole("button", { name: "Ascent", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Haven", exact: true })).toHaveAttribute("aria-pressed", "true");
  // No prediction fires just from navigating here with a pre-filled draft.
  await expect(page.getByText("Predicted Winner")).toHaveCount(0);
});

test("result-level links reflect the generated result and stay stable while the simulator and breakdown are used", async ({
  page,
}) => {
  await page.goto("/prediction-studio");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  await page.getByRole("button", { name: "Ascent" }).click();
  await page.getByRole("button", { name: "Generate Prediction" }).click();
  await expect(page.getByText("Predicted Winner")).toBeVisible({ timeout: 15_000 });

  const resultLink = page.getByRole("link", { name: /Compare Teams/ });
  const hrefBefore = await resultLink.getAttribute("href");

  // Interact with the What-if Simulator and the breakdown tabs — neither
  // should change the result-level link.
  await expect(page.getByRole("heading", { name: "What-if Simulator" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("tab", { name: "Match DNA" }).click();

  const hrefAfter = await page.getByRole("link", { name: /Compare Teams/ }).getAttribute("href");
  expect(hrefAfter).toBe(hrefBefore);
});

test("browser back/forward restores prior URL-backed selections across a real page navigation", async ({ page }) => {
  // Same-page selection changes use router.replace (by design — see
  // requirement 6, "no flood"), so they intentionally don't each become a
  // separate back-stack entry. What must work is restoring state across an
  // actual page-to-page navigation, which does push a history entry.
  await page.goto("/team-comparison");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  await expect(page.getByText("Overall Rating")).toBeVisible();
  // router.replace() is async — component state (hence "Overall Rating")
  // can be visible a render or two before the URL/history entry it drives
  // actually commits. The history entry this test's later goBack() must
  // land on is exactly this one (replaced in place, never pushed — see the
  // comment above), so the actual query string, not just rendered text,
  // has to be confirmed before navigating away from it. Same reasoning as
  // the "Copy Link" test below. Without this, a fast click here can
  // navigate away before the second replace() lands, so goBack() later
  // restores an earlier (or empty) history state — reproduced as an
  // intermittent, load-sensitive "Paper Rex button not found after
  // goBack()" failure without this wait.
  await expect(page).toHaveURL(/teamA=paper-rex/);
  await expect(page).toHaveURL(/teamB=g2-esports/);

  await page.getByRole("link", { name: /Open in Prediction Studio/ }).click();
  await expect(page).toHaveURL(/prediction-studio/);
  await expect(page.getByRole("button", { name: /Paper Rex/ })).toHaveAttribute("aria-pressed", "true");

  // goBack()/goForward() re-render an async Server Component page via a
  // fresh RSC round-trip (these routes have dynamic searchParams, so
  // there's no static cache to serve instead) — measurably heavier than a
  // normal Link click, and observed to occasionally exceed the suite's
  // default timeout only late in a full single-worker run (never in
  // isolation) as the long-lived dev server/browser accumulate load. A
  // longer timeout here is a test-runtime margin, not a functional wait.
  await page.goBack();
  await expect(page).toHaveURL(/team-comparison/, { timeout: 15_000 });
  await expect(page.getByText("Overall Rating")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /Paper Rex/ })).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });

  await page.goForward();
  await expect(page).toHaveURL(/prediction-studio/, { timeout: 15_000 });
  await expect(page.getByRole("button", { name: /G2 Esports/ })).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
});

test("cross-feature links use normal anchor hrefs, compatible with opening in a new tab", async ({ page }) => {
  await page.goto("/prediction-studio");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");

  const link = page.getByRole("link", { name: /Compare Teams/ });
  expect(await link.getAttribute("href")).toMatch(/^\/team-comparison\?/);
  expect(await link.evaluate((el) => el.tagName)).toBe("A");
});

test("mobile layout renders cross-feature links without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/team-comparison");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");

  await expect(page.getByRole("link", { name: /Open in Prediction Studio/ })).toBeVisible();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
});

test("the page is accessible with cross-feature links rendered", async ({ page }) => {
  await page.goto("/team-comparison");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  await page.waitForTimeout(400);

  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("Copy Link copies the current canonical URL and announces success", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/team-comparison");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  // Wait for the URL sync to actually land before copying it.
  await expect(page).toHaveURL(/teamB=g2-esports/);

  await page.getByRole("button", { name: "Copy Link" }).click();
  await expect(page.getByRole("status")).toHaveText("Link copied");

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("teamA=paper-rex");
  expect(copied).toContain("teamB=g2-esports");
});

test("no console errors or failed asset/network requests across a cross-feature navigation path", async ({ page }) => {
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("requestfailed", (req) => {
    // Next.js's <Link> prefetches its RSC payload as the href changes with
    // every team selection; a stale prefetch is intentionally cancelled
    // (net::ERR_ABORTED) the moment a newer one supersedes it — not a real
    // network failure.
    if (req.failure()?.errorText === "net::ERR_ABORTED") return;
    failedRequests.push(req.url());
  });
  page.on("response", (res) => {
    if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`);
  });

  await page.goto("/prediction-studio");
  await selectTeam(page, "A", "Pacific", "Paper Rex");
  await selectTeam(page, "B", "Americas", "G2 Esports");
  await page.getByRole("link", { name: /Explore Maps/ }).click();
  await expect(page).toHaveURL(/map-matchup/);
  await page.getByRole("link", { name: /Open in Prediction Studio/ }).click();
  await expect(page).toHaveURL(/prediction-studio/);

  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
