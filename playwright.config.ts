import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  // Default 5000ms is occasionally too tight against the dev server's
  // on-demand per-route compilation (webServer runs `next dev`, not a
  // production build) — the largest routes (prediction-studio,
  // team-comparison, map-matchup) can take longer than 5s to compile on
  // their first visit in a given server lifetime, causing an intermittent
  // toHaveURL timeout on whichever test first navigates to a cold route.
  // Not a product bug: confirmed by re-running the suite multiple times and
  // observing a different specific test fail each time, always clustered
  // around client-side navigation into one of those three routes.
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // A production server (build + start), not `next dev`. The dev server's
    // Fast Refresh module tracking and on-demand per-route compilation grow
    // steadily over one long single-worker run (~79 tests, ~2min), making
    // the *later* server round-trips in a run measurably slower than the
    // same interaction tested in isolation — this reproduced deterministically
    // as an intermittent failure specifically on browser back/forward
    // navigation late in a full-suite run, never in isolation, and never on
    // a fresh dev server. A production server has none of that per-route
    // compile/refresh overhead and is also more representative of real user
    // behavior for e2e purposes.
    command: "pnpm --filter web build && pnpm --filter web start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
