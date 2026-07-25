import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Power Rankings. Unlike Prediction Studio/Comparison Lab/Map Explorer, this
 * page needs no prior team selection — the golden path is just navigating
 * to it, since all 32 teams are always ranked.
 */

test("direct navigation to /power-rankings renders the page on refresh", async ({ page }) => {
  await page.goto("/power-rankings");
  await expect(page.getByRole("heading", { name: "Power Rankings", level: 1 })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Power Rankings", level: 1 })).toBeVisible();
});

test("nav includes a Power Rankings entry with correct active state", async ({ page }) => {
  await page.goto("/");
  const primaryNav = page.getByRole("navigation", { name: "Primary" });
  const navLink = primaryNav.getByRole("link", { name: "Power Rankings" });
  await expect(navLink).toBeVisible();

  await navLink.click();
  await expect(page).toHaveURL(/power-rankings/, { timeout: 15_000 });
  await expect(primaryNav.getByRole("link", { name: "Power Rankings" })).toHaveAttribute("aria-current", "page");
});

test("golden path: Global mode shows a sealed Top 3 podium, a visible board of 29 teams, and the disclosure", async ({
  page,
}) => {
  await page.goto("/power-rankings");

  await expect(page.getByRole("button", { name: "Reveal Global rank 1 team" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reveal Global rank 2 team" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reveal Global rank 3 team" })).toBeVisible();

  const board = page.getByRole("list", { name: "Global power ranking, rank 4 and below" });
  await expect(board).toBeVisible();
  await expect(board.getByRole("listitem")).toHaveCount(29);

  // This dev/CI environment has a real generated VLR dataset, so the page
  // renders the real-data disclosure rather than the synthetic fallback —
  // see `app/power-rankings/page.tsx` and `server/prediction/powerRankingsRepository.ts`.
  await expect(page.getByText(/These rankings are computed from real ingested VCT match data/)).toBeVisible();
});

test("revealing a Top 3 card shows the team, and it stays revealed after switching modes", async ({ page }) => {
  await page.goto("/power-rankings");

  const revealButton = page.getByRole("button", { name: "Reveal Global rank 1 team" });
  await revealButton.click();
  await expect(revealButton).not.toBeVisible();
  await expect(page.getByRole("button", { name: "View full dossier" }).first()).toBeVisible();

  await page.getByRole("tab", { name: "Regional" }).focus();
  await page.getByRole("tab", { name: "Regional" }).click();
  await page.getByRole("tab", { name: "Global" }).click();

  await expect(page.getByRole("button", { name: "Reveal Global rank 1 team" })).not.toBeVisible();
});

test("Regional mode never hides a team, and each region shows 8 teams total", async ({ page }) => {
  await page.goto("/power-rankings");
  await page.getByRole("tab", { name: "Regional" }).click();

  await expect(page.getByRole("button", { name: /^Reveal / })).toHaveCount(0);

  for (const region of ["VCT Americas", "VCT EMEA", "VCT Pacific", "VCT China"]) {
    await page.getByRole("tab", { name: region }).click();
    const board = page.getByRole("list", { name: `${region} power ranking, rank 4 and below` });
    await expect(board).toBeVisible();
    await expect(board.getByRole("listitem")).toHaveCount(5);
  }
});

test("mode and region switches never navigate the page", async ({ page }) => {
  await page.goto("/power-rankings");
  const urlBefore = page.url();

  await page.getByRole("tab", { name: "Regional" }).click();
  await page.getByRole("tab", { name: "VCT EMEA" }).click();
  await page.getByRole("tab", { name: "Global" }).click();

  expect(page.url()).toBe(urlBefore);
});

test("opens the Team Dossier from a visible board row, shows the score breakdown, and closes it", async ({
  page,
}) => {
  await page.goto("/power-rankings");

  const firstRow = page.getByRole("list", { name: "Global power ranking, rank 4 and below" }).getByRole("listitem").first();
  await firstRow.getByRole("button").click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Power Score")).toBeVisible();
  await expect(dialog.getByText("Baseline", { exact: true })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("full keyboard-only flow: mode switch, region tab, reveal, dossier open/close", async ({ page }) => {
  await page.goto("/power-rankings");

  const globalTab = page.getByRole("tab", { name: "Global" });
  await globalTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Regional" })).toHaveAttribute("aria-selected", "true");

  const firstRegionTab = page.getByRole("tab").nth(2);
  await firstRegionTab.focus();
  await expect(firstRegionTab).toHaveAttribute("aria-selected", "true");

  const sealedCard = page.getByRole("button", { name: /^Reveal / });
  const count = await sealedCard.count();
  if (count > 0) {
    await sealedCard.first().focus();
    await page.keyboard.press("Enter");
  }

  const dossierButton = page.getByRole("button", { name: "View full dossier" }).first();
  await dossierButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("mobile layout renders without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/power-rankings");

  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  const scrollWidthBefore = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidthBefore).toBeLessThanOrEqual(clientWidth + 1);

  await page.getByRole("tab", { name: "Regional" }).click();
  const scrollWidthAfter = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidthAfter).toBeLessThanOrEqual(clientWidth + 1);
});

test("mobile Top 3 podium stacks in #1, #2, #3 order top-to-bottom", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/power-rankings");

  const rank1 = page.getByRole("button", { name: "Reveal Global rank 1 team" });
  const rank2 = page.getByRole("button", { name: "Reveal Global rank 2 team" });
  const rank3 = page.getByRole("button", { name: "Reveal Global rank 3 team" });
  await expect(rank1).toBeVisible();
  await expect(rank2).toBeVisible();
  await expect(rank3).toBeVisible();

  const rank1Box = await rank1.boundingBox();
  const rank2Box = await rank2.boundingBox();
  const rank3Box = await rank3.boundingBox();
  if (!rank1Box || !rank2Box || !rank3Box) throw new Error("Expected all three podium cards to have a bounding box.");

  expect(rank1Box.y).toBeLessThan(rank2Box.y);
  expect(rank2Box.y).toBeLessThan(rank3Box.y);
});

test("reduced motion: revealing a Top 3 card shows the final content immediately", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/power-rankings");

  await page.getByRole("button", { name: "Reveal Global rank 1 team" }).click();
  await expect(page.getByRole("button", { name: "View full dossier" }).first()).toBeVisible();
});

test("the page is accessible in Global mode, Regional mode, and with the dossier open", async ({ page }) => {
  await page.goto("/power-rankings");
  await expect(page.getByRole("heading", { name: "Power Rankings", level: 1 })).toBeVisible();
  // Let the podium cards' motion-safe entrance stagger settle before scanning
  // — mid-fade text is briefly lower-opacity, which reads as a false-positive
  // contrast violation (same rationale as team-comparison.spec.ts and
  // prediction-breakdown.spec.ts's axe checks).
  await page.waitForTimeout(400);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole("tab", { name: "Regional" }).click();
  await page.waitForTimeout(400);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole("tab", { name: "Global" }).click();
  await page.waitForTimeout(400);
  const firstRow = page.getByRole("list", { name: "Global power ranking, rank 4 and below" }).getByRole("listitem").first();
  await firstRow.getByRole("button").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // The Global board's 29-row StaggerGroup (rank 4 and below) staggers every
  // row's own entrance by 0.08s regardless of scroll position — the last row
  // doesn't finish fading in until roughly (29 - 1) * 0.08s + 0.5s duration
  // ≈ 2.8s after the tab mounts it, and axe scans the full DOM, not just
  // what's currently scrolled into view, so a still-fading row well below the
  // fold can fail contrast just as easily as a visible one. Settle well past
  // that worst case before this final scan.
  await page.waitForTimeout(3000);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("no console errors or failed asset/network requests across a golden-path interaction", async ({ page }) => {
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

  await page.goto("/power-rankings");
  await page.getByRole("button", { name: "Reveal Global rank 1 team" }).click();
  await page.getByRole("tab", { name: "Regional" }).click();
  await page.getByRole("tab", { name: "VCT Pacific" }).click();
  const firstRow = page.getByRole("list", { name: /power ranking, rank 4 and below/ }).getByRole("listitem").first();
  await firstRow.getByRole("button").click();
  await page.keyboard.press("Escape");

  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test("mode/region switches use router.replace, so they never grow browser history (matching the other 3 features)", async ({
  page,
}) => {
  await page.goto("/power-rankings");
  await page.getByRole("tab", { name: "Regional" }).click();
  await page.getByRole("tab", { name: "VCT EMEA" }).click();
  await expect(page).toHaveURL(/mode=regional/);
  await expect(page).toHaveURL(/region=emea/);

  // Only one real history entry exists (the initial goto) — every mode/region
  // switch replaced it in place rather than pushing a new one, so going back
  // leaves the app entirely, the same behavior team-comparison/map-matchup/
  // prediction-studio already rely on for their own canonical URL state.
  await page.goBack();
  await expect(page).toHaveURL("about:blank");
});

test("a real page-to-page navigation from the Team Dossier round-trips through back/forward", async ({ page }) => {
  await page.goto("/power-rankings");

  const firstRow = page.getByRole("list", { name: "Global power ranking, rank 4 and below" }).getByRole("listitem").first();
  await firstRow.getByRole("button").click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.getByRole("link", { name: /^Compare / }).click();
  await expect(page).toHaveURL(/team-comparison/, { timeout: 15_000 });

  await page.goBack();
  await expect(page).toHaveURL(/power-rankings/, { timeout: 15_000 });

  await page.goForward();
  await expect(page).toHaveURL(/team-comparison/, { timeout: 15_000 });
});
