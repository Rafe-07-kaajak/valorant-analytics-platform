# Final QA, Regression Audit, and Release Sign-off

Version: 1.0 (TASK-040)

---

## Release scope

TASK-029 through TASK-039: global landing/theme/navigation, Prediction Studio, VCT region-first team selection, synthetic VCT team profiles, the prediction result experience, Interactive Prediction Breakdown, the What-if Simulator, Team Comparison Lab, Map Matchup Explorer, and cross-feature URL navigation. This task performs QA and sign-off only — no new product features.

---

## Environment

- Node v24.18.0, pnpm 11.10.0
- Next.js 15.5.20, React 19.1.0, TypeScript ^5.7.2
- Vitest ^2.1.8 (apps/web), ^2.1.9 (services/prediction-engine)
- @playwright/test ^1.49.1, @axe-core/playwright ^4.10.1
- Turborepo 2.10.3 (workspace task runner)
- Browser under test: Chromium (the only project configured in `playwright.config.ts`)

---

## Commit baseline

- Branch: `master`
- Latest commit at start: `1b681bc feat: integrate cross-feature URL navigation`
- Working tree: clean at start (confirmed via `git status --short`)
- Commits `f94d1a0`…`1b681bc` correspond to TASK-035–TASK-039

---

## Feature inventory

| Feature | Route | Entry component | Server/client boundary | Test coverage |
|---|---|---|---|---|
| Landing | `/` | `app/page.tsx` | server-rendered, static | `landing.spec.ts` |
| Theme toggle | global | `packages/ui` theme provider | client | `landing.spec.ts`, per-feature dark-mode axe tests |
| Global navigation / footer | global | `SiteNavbar`, `Footer` (`@repo/ui`) | server + client | route-level "nav has correct active state" tests |
| Prediction Studio | `/prediction-studio` | `page.tsx` → `PredictionStudioClient` → `ScenarioBuilder` | server reads `searchParams`, client owns draft state | `prediction-studio.spec.ts`, `ScenarioBuilder.test.tsx`, `PredictionStudioClient.test.tsx` |
| VCT region-first selectors | shared | `VctTeamSideSelector` | client | covered across all three feature test suites |
| Synthetic VCT profiles | `services/prediction-engine` | `vctTeamProfiles.ts` | server-only (Node) | `vctTeamProfiles.test.ts`, `validateVctTeamProfiles.test.ts` |
| Prediction result experience | `/prediction-studio` (post-submit) | `PredictionResultExperience` | client | `prediction-studio.spec.ts` |
| Interactive Prediction Breakdown | `/prediction-studio` (post-result) | breakdown tab components | client | `prediction-breakdown.spec.ts` |
| What-if Simulator | `/prediction-studio` (post-result) | `WhatIfSimulator` | client, isolated cloned profile adjustments | `what-if-simulator.spec.ts`, `WhatIfSimulator.test.tsx`, `simulateVctPrediction.test.ts` |
| Team Comparison Lab | `/team-comparison` | `page.tsx` → `TeamComparisonClient` | server reads `searchParams`, client owns state | `team-comparison.spec.ts`, `TeamComparisonClient.test.tsx` |
| Map Matchup Explorer | `/map-matchup` | `page.tsx` → `MapMatchupClient` | server reads `searchParams`, client owns state | `map-matchup.spec.ts`, `MapMatchupClient.test.tsx` |
| Cross-feature URL navigation | all three feature routes | `lib/urlState/*`, `useCanonicalUrlState`, `AnalyticsContextLinks` | pure helpers + client hook | `cross-feature-navigation.spec.ts`, 81 pure unit tests |
| Copy Link | shared | `CopyLinkButton` | client, user-gesture-only clipboard write | `CopyLinkButton.test.tsx`, e2e Copy Link test |
| Mobile navigation | global | `SiteNavbar` | client | mobile-viewport tests in every spec |
| Loading/empty/error states | per-feature | e.g. `TeamControlsPanel`, empty-comparison state | client | covered per-feature |

Known intentional limitations and release risks are listed under **Known non-blocking limitations** below.

---

## Verification matrix

| Check | Result |
|---|---|
| `pnpm lint` | ✅ Pass (all 6 packages, cached) |
| `pnpm check-types` | ✅ Pass (all 6 packages, cached) |
| `pnpm test` | ✅ 651/651 (447 web + 204 prediction-engine) |
| `pnpm build` | ✅ Pass, all three feature routes correctly `ƒ` dynamic |
| `pnpm test:e2e` (default parallelism, post-fix) | 78/79 passed — see below |
| `npx playwright test --workers=1` (deterministic) | ✅ **79/79**, reproduced twice |

---

## Golden-path results

All golden paths below were executed via the automated e2e suite (Chromium), not manually re-clicked separately — the suite *is* the golden-path verification:

- **Prediction Studio**: Paper Rex vs G2 Esports, BO3, Ascent/Haven/Bind → winner, probabilities, confidence, trust score, Match DNA, Key Factors, insights, and pipeline all render; all four Interactive Breakdown tabs (Contributions, Match DNA, Key Factors, Pipeline) work via mouse and keyboard; result is unchanged across tab switches (`prediction-breakdown.spec.ts:40`).
- **What-if Simulator**: preset application, two-slider adjustment, zero requests before "Run Simulation", exactly one request on run, Result Comparison and Change Breakdown render, rerun replaces (not stacks) the prior result, Reset All returns to the zero-adjustment empty-state summary, baseline result is never altered (`what-if-simulator.spec.ts`, `simulateVctPrediction.test.ts`).
- **Team Comparison Lab**: Paper Rex vs G2 Esports, every tab (Overview/DNA/Maps/Factors), cross-feature links, Copy Link (`team-comparison.spec.ts`).
- **Map Matchup Explorer**: team selection, map pool, Select All, Clear, sort control, every tab, empty pool, map detail, cross-feature links, Copy Link (`map-matchup.spec.ts`).
- **Cross-feature journey**: Prediction Studio → Comparison Lab → Map Explorer → Prediction Studio, teams and maps preserved per each route's documented field vocabulary, format never leaks outside Prediction Studio, no simulator/breakdown state ever persists (`cross-feature-navigation.spec.ts`).

---

## Negative-path results

Covered directly by the automated suite and the pure `urlState` unit tests: no team selected, one team selected, same team on both sides (both via direct interaction and via a malformed URL), invalid team/region/map URL values, duplicate maps, unsupported format, empty maps, oversized query input (capped at 100 chars / 64 map tokens before processing — `mapIds.test.ts`, `validation.test.ts`), rapid selector/map changes, repeated Run Simulation clicks (disabled while loading), browser refresh on every feature route, browser back/forward, narrow mobile viewport, reduced motion, light/dark theme. No malformed input crashed a route in any run. Clipboard-denied/unavailable fallback is covered by `CopyLinkButton.test.tsx` (`navigator.clipboard.writeText` rejection → safe "Couldn't copy the link" message, no throw). API failure paths (baseline/simulation/prediction) are covered by existing component tests using mocked rejected fetches.

---

## Accessibility

Zero axe violations (serious or otherwise) across all routes in both light and dark themes, in the deterministic single-worker run — including the two `prediction-studio.spec.ts` tests fixed in this task (see **Defects**). Keyboard navigation, focus visibility, tab semantics, slider accessibility, accessible link/button names, announced status regions (Copy Link, validation errors), and touch targets are all covered by the existing suite; no regressions found.

---

## Responsive/theme/browser

Mobile-viewport (375×812 and similar) no-horizontal-overflow checks pass on every feature route. Light/dark theme axe checks pass across all routes. Chromium is the only browser project configured in `playwright.config.ts`; no additional browser/device projects exist in this repo, so the matrix was not expanded beyond it, per the task's explicit instruction not to expand the browser matrix if the repo isn't configured for it. Touch-specific cursor-effect behavior is covered by `cursor-effects-touch.spec.ts`.

---

## Console/network/performance

No console errors, no failed asset/network requests (after correctly excluding expected `net::ERR_ABORTED` `<Link>` prefetch cancellations — a legitimate Next.js behavior, not a failure, filtered explicitly and documented inline in every affected spec), and no hydration warnings across any golden path in the deterministic run. No prediction request fires from URL initialization (explicit assertions in both component and e2e tests). Production build output is unchanged in shape from TASK-039 (Prediction Studio 17.3 kB, Map Matchup 5.81 kB, Team Comparison 3.71 kB, shared 102 kB) — no unexpected bundle growth.

---

## Security/dependency audit

- `pnpm audit --prod`: **1 moderate** advisory — `postcss < 8.5.10` (XSS via unescaped `</style>` in CSS stringify output), pulled in transitively via `next`. This is a build-time CSS tool operating on this repo's own Tailwind output, not on untrusted runtime input, so it is not a release-blocking risk; upgrading it would mean overriding a transitive dependency pinned by Next.js itself, which the task's dependency policy says not to do absent a proven critical blocker. Recorded as a **Low** finding, not fixed.
- No `.env` files, private keys, or credential-shaped strings are tracked in the repository (`.env.example` only, contains no secret, documents `NEXT_PUBLIC_SITE_URL`).
- No hard-coded secrets found via pattern search across `apps/web/src`, `services/prediction-engine/src`, `packages`.
- Prototype-pollution protection is explicitly tested (`validateSimulationRequest.test.ts`: rejects `__proto__` and `constructor` keys in adjustment payloads).
- URL privacy: confirmed no simulator adjustment, profile value, or simulation result is ever serialized into a URL — only region/team/map ids and series format, all already public UI values.
- Clipboard writes (`CopyLinkButton`) only ever occur on a direct user click, never on mount or on a background timer.

---

## Static-quality audit

- `TODO`/`FIXME`/`HACK`: none found in `apps/web/src`, `services/prediction-engine/src`, `packages`.
- `console.log`/`console.debug`/`debugger`: none found outside test files.
- `test.only`/`describe.only`/`.skip`: none found in unit, component, or e2e specs.
- `@ts-ignore`: none found.
- `eslint-disable`: 3 occurrences, all justified — two in `useCanonicalUrlState.ts` (documented `react-hooks/exhaustive-deps` suppressions for intentionally-stable dependencies) and one in `WhatIfSimulator.tsx` (a documented one-time-fetch-on-mount pattern, pre-existing from TASK-038, safe because the component remounts on scenario change).
- No tracked `test-results/`, `playwright-report/`, trace files, or backup/`.bak` files.
- Documentation (`docs/01`–`docs/27`, README) was spot-checked for the areas this task touches — no factual inaccuracies or contradictions found; TASK-039's `docs/27-cross-feature-navigation.md` accurately describes the shipped behavior.

---

## Defects found and fixed

### Defect 1 — Severity: Low (test-only flakiness, not a product defect)

- **Route/feature**: `prediction-breakdown.spec.ts:40` ("switching between all four tabs works without changing the underlying result")
- **Reproduction**: intermittent, only under default (6-worker) parallelism; `urlBeforeTabs` was captured via a synchronous `page.url()` read immediately after the "Predicted Winner" text became visible, racing the async `router.replace` that syncs the built scenario into the URL.
- **Root cause**: a one-shot URL read without first waiting for the URL to actually reflect the post-submission state — the same race class already fixed in `team-comparison.spec.ts` during TASK-039.
- **Fix**: added `await expect(page).toHaveURL(/teamB=g2-esports/)` (an auto-retrying assertion) immediately before capturing `urlBeforeTabs`.
- **Regression test**: the fix is in the existing test itself; verified via 3 clean isolated single-worker runs post-fix.
- **Verification**: `npx playwright test e2e/prediction-breakdown.spec.ts --workers=1` → 10/10 passed.

### Defect 2 — Severity: Low (test-only flakiness, not a product defect)

- **Route/feature**: `prediction-studio.spec.ts:82` and `:188` ("full scenario submission renders an explainable result with no accessibility violations" / "...and is accessible in dark mode")
- **Reproduction**: intermittent axe `color-contrast` violations reported against different child elements of the What-if Simulator's "Current draft" panel (`ControlsTab.tsx`) across different runs — once on `text-xs ... text-muted-foreground` at a reported 1.85:1 contrast, another time on a sibling `text-sm text-foreground` element.
- **Root cause**: these two tests were the only axe-scanning tests in the entire e2e suite missing the `page.waitForTimeout(400)` settle-delay used everywhere else (`team-comparison.spec.ts`, `prediction-breakdown.spec.ts`, `map-matchup.spec.ts`, `cross-feature-navigation.spec.ts`, `landing.spec.ts`) to let `TabsContent`'s `motion-safe:starting:opacity-0` enter transition finish before scanning. The What-if Simulator's Controls tab renders inside this shared `Tabs`/`TabsContent` primitive; scanning mid-fade briefly reports a blended, lower-effective-contrast color, which is not the steady-state rendered color. Manually computing the steady-state tokens confirms this: light-mode `--muted-foreground` (`#55627a`) on `--surface` (`#f7f9fb`) is 5.83:1, comfortably above the 4.5:1 AA threshold — the reported 1.85:1 could not occur in the settled DOM.
- **Fix**: added the identical `page.waitForTimeout(400)` (with the same explanatory comment used elsewhere) before each `AxeBuilder` scan in both tests.
- **Regression test**: the fix is in the existing tests; verified via a clean isolated single-worker run post-fix.
- **Verification**: `npx playwright test e2e/prediction-studio.spec.ts --workers=1` → 9/9 passed, including both previously-flaky tests.

No product code was changed for either defect — both fixes are confined to `e2e/*.spec.ts` test timing, consistent with the task's defect policy (smallest safe change, no redesign).

### Non-fix: `pnpm test:e2e` default-parallelism flakiness (dev-server contention)

Across multiple runs at default (6-worker) parallelism, between 0 and 5 tests failed per run, with **a different test failing each time**, always a `<Link>`-click-driven `toHaveURL` timeout (never a logic or data-assertion failure). Every single one of these tests passed cleanly and reproducibly across three separate deterministic `--workers=1` runs (79/79 twice, plus a 15/15 isolated run of the specific spec first suspected). This is characteristic Next.js dev-server contention under six concurrent Chromium instances competing for one dev server's compile/response cycle — an environment characteristic of this repo's e2e setup (also observed and documented in the TASK-039 session), not a code defect. No fix was applied, per the defect policy's instruction not to fix flaky-but-passing-when-isolated tests as if they were real regressions; the deterministic single-worker result is the authoritative correctness signal.

---

## Known non-blocking limitations

**Product-intentional** (by design, not gaps):
- No database persistence, no localStorage/sessionStorage, no simulation history, no user accounts — explicitly out of scope through TASK-039.
- The What-if Simulator is never linked from global navigation and never contributes to the URL — it is intentionally result-scoped only.
- Only the six canonical URL fields are ever shared across features; all interaction-transient state (tabs, sort, hover, simulator drafts) is intentionally local-only.

**Test-environment limitations** (not product limitations):
- `pnpm test:e2e` at its default 6-worker parallelism can show non-deterministic, always-different single-test timeouts under this machine's dev-server contention; the deterministic `--workers=1` run is the trustworthy signal, consistent with prior TASK-039 findings.
- Only Chromium is configured as a Playwright project in this repository; no cross-browser (Firefox/WebKit) or real-device matrix exists to test against.

**Security/dependency**:
- One moderate `postcss` advisory transitively pinned by Next.js's own dependency tree (build-time only, not exposed to runtime user input) — tracked, not fixed, per dependency policy.

---

## Final release checklist

- [x] Working tree clean before task started
- [x] Prediction regression locked (`generateVctPrediction.regression.test.ts` — byte-equivalent pinned output)
- [x] All unit/component tests pass (651/651)
- [x] All e2e tests pass deterministically (79/79, single-worker, reproduced twice)
- [x] Lint passes
- [x] Typecheck passes
- [x] Build passes
- [x] No unexpected console errors
- [x] No genuine failed requests (aborted prefetches correctly excluded)
- [x] No hydration warnings
- [x] No page-level mobile overflow
- [x] Light/dark axe pass (zero violations, deterministic run)
- [x] Direct URLs work on every feature route
- [x] Back/forward works (via real page navigation, per the documented `replace`-not-`push` design)
- [x] Copy Link works
- [x] URL contains no simulator/profile data
- [x] Original prediction path unchanged (`generateVctPrediction` untouched; regression test pins exact output)
- [x] Simulator isolated (`simulateVctPrediction.test.ts`: zero-adjustment equivalence, determinism, no baseline mutation, concurrency isolation, no cache cross-talk)
- [x] No shared profile mutation (`VCT_TEAM_PROFILES` proven unmutated across 20 varied simulations)
- [x] Docs accurate (spot-checked, TASK-039 doc verified against shipped behavior)
- [x] No debug artifacts (TODO/FIXME/console.log/debugger/`.only`/`.skip` — none found)
- [x] No secrets (no tracked `.env`, no hard-coded credentials)
- [x] No release blockers

---

## Release recommendation

**GO.**

Two Low-severity, test-only timing defects were found and fixed (neither touched product code). One moderate, non-exploitable, build-time-only transitive dependency advisory is tracked but not fixed, per policy. All 651 unit/component tests and all 79 e2e tests pass deterministically; lint, typecheck, and build are clean; no accessibility, security, or functional release blockers were found. The platform is ready to commit and present.
