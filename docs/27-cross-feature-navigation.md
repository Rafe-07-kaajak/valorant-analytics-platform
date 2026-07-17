# Cross-feature Navigation and State Integration

Version: 1.0 (TASK-039)

---

## Purpose

Unifies Prediction Studio, Team Comparison Lab, and Map Matchup Explorer into one connected workflow: the currently selected Team A / Team B (and, where relevant, the selected maps) travel with the user as they move between the three features, via an explicit, shareable, human-readable URL — never via localStorage, sessionStorage, or a database. The What-if Simulator remains entirely result-scoped and untouched by this integration; it is never linked from global navigation and never contributes anything to the URL.

---

## Canonical URL contract

Six parameters, always emitted in this order when present:

```
regionA, teamA, regionB, teamB, maps, format
```

Example:

```
/prediction-studio?regionA=pacific&teamA=paper-rex&regionB=americas&teamB=g2-esports&maps=ascent,haven,bind&format=BO3
```

- `maps` is a comma-separated, deduplicated list, always serialized in **canonical order** — the order of `@repo/prediction-engine`'s `maps` list (Ascent, Haven, Bind, Lotus, Pearl, Split, Sunset, Icebox), not click order.
- `format` is `BO3` or `BO5`; absent when not applicable.
- Empty/default values are omitted entirely — no `regionA=` with no region, no `maps=` with an empty pool.
- No raw JSON ever appears in a query parameter; no simulator adjustment or profile value is ever exposed.

### Each route's vocabulary

| Route | Fields it reads, writes, and accepts from a link |
|---|---|
| Prediction Studio | `regionA, teamA, regionB, teamB, maps, format` |
| Team Comparison Lab | `regionA, teamA, regionB, teamB` |
| Map Matchup Explorer | `regionA, teamA, regionB, teamB, maps` |

A route only ever writes the fields it understands. Any other query parameter present in the URL — a canonical field foreign to that route (e.g. `format=` on `/team-comparison`), or a genuinely unrecognized one — is silently dropped the first time that route's state is synced back to the URL. This keeps every generated URL fully self-consistent and is the documented rule for "unknown parameter" handling (TASK-039 requirement 12).

### Validation and repair rules (`apps/web/src/lib/urlState/parse.ts`)

- Unknown team id → treated as absent.
- **A valid team id is always the source of truth for its region.** If `teamA` is valid, `regionA` is always derived from the team (`regionForTeam`), overwriting whatever `regionA=` said — this is the one deterministic repair rule for every region/team disagreement, chosen because the team is the more specific, more intentional signal.
- No team present → a valid `regionA`/`regionB` is kept as-is (to preload that side's team grid); an invalid one is cleared.
- Same team on both sides → **Team A wins, Team B is cleared.**
- `maps=` — deduplicated, validated against the real map list, reordered canonically; invalid entries are dropped; an absent or empty value is a valid "zero maps" result.
- An unsupported `format=` is dropped (`null`), never crashes.
- When a valid `format` is present, `maps` is capped to that format's `SERIES_MAP_LIMITS` — a genuine cross-field rule of the domain, applied once, centrally, rather than per feature.
- Every raw parameter value is capped at 100 characters and every `maps=` value is capped at 64 raw comma-separated tokens before any processing, so no pathological input can make parsing expensive or crash a route.

This is one implementation (`parseUrlState`), used identically on the server (via a small `toUrlSearchParams` adapter over Next's server `searchParams` object) and in the client-side sync hook — there is no second, divergent parser.

---

## Shared vs. local state

**Shared** (the six canonical fields above): Team A/B region and team, selected maps where the destination supports them, series format only when the destination is Prediction Studio.

**Feature-local, never in the URL**: active tab, sort mode, active contribution/DNA dimension/factor/pipeline stage, What-if Simulator draft values and results, loading/error state, hover state, active map-detail row, cursor state. None of TASK-033/034/037/038's interaction state was touched.

---

## Feature integration

### Prediction Studio

`ScenarioBuilder` owns its draft (region/team/format/maps) via `useCanonicalUrlState`, initialized from the server-parsed URL. Selecting a region, team, map, or format updates the URL; **no auto-submit** — a complete URL-backed draft still requires an explicit "Generate Prediction" click. Once a result exists, `ScenarioBuilder`'s own draft-level cross-feature links hide (`hasResult` prop) and `PredictionStudioClient` renders a second, result-scoped set of links fed by `result.scenario` — never by the draft, the What-if Simulator, or the breakdown tabs. If the user tweaks the draft after a result exists, the result-level links stay exactly as they were: **the result's scenario remains authoritative until a new result replaces it.**

### Team Comparison Lab

`TeamComparisonClient` initializes both sides from the URL and renders the full comparison immediately if both are valid; a partial or empty URL produces the existing partial/empty state, unchanged from TASK-035. No API call was added.

### Map Matchup Explorer

`MapMatchupClient` initializes both teams and the map pool from the URL. Sort mode, the active map, and the active tab remain local `useState`, as before. Select All / Clear / Close Maps each still call `setSelectedMapIds` exactly once, which now also updates the URL exactly once per action.

---

## Shared navigation component

`AnalyticsContextLinks` (`apps/web/src/components/AnalyticsContextLinks.tsx`) — `{ currentFeature, state, placement, showCopyLink }`. Renders nothing until both teams are validly selected; generates only the two destinations other than `currentFeature`, via the shared `generateFeatureLinks`/`buildFeatureHref` helpers (`lib/urlState/links.ts`) — no component hand-builds a query string. Labels are keyed by *(source, destination)* pair per the task's exact wording (e.g. Prediction Studio → Map Matchup Explorer reads "Explore Maps"; Team Comparison Lab → Map Matchup Explorer reads "Explore Map Matchup"). Every link's accessible name states both the destination and the preserved team names. `placement="compact"` is used next to a selector; `placement="result"` is used next to a generated prediction.

**Copy Link** (`CopyLinkButton.tsx`) is implemented — it was not disproportionately complex. It copies `window.location.href` (never a manually reconstructed string) only on click, shows "Link copied" or a safe "Couldn't copy the link" fallback in an `aria-live="polite"` status region, and clears after 2 seconds via a timeout that's cleaned up on unmount.

---

## Browser history

`useCanonicalUrlState` (`apps/web/src/hooks/useCanonicalUrlState.ts`) is the one hook every feature uses:

- **State → URL**: `router.replace` (never `push`), so rapid selection changes never flood history. Skipped entirely on mount — loading a page, even one whose URL needed repair, never itself issues a `replace`.
- **URL → state**: reacts to `useSearchParams()` changing (e.g. back/forward), re-parsing through the same `parseUrlState`.
- **Loop prevention**: two refs — the last raw query string seen, and the last canonical query string believed current — because the raw URL and its canonical serialization can be the same query in a different parameter order. Reconciling an externally-changed URL into state never triggers a second, unwanted `replace` just to re-order parameters.
- Since same-page updates use `replace`, they intentionally do not each become a separate back-stack entry (per requirement 6's explicit "no flood" instruction). What restores across back/forward is state across a real page-to-page navigation (e.g. following a cross-feature `<Link>`, which does push a history entry) — verified in `e2e/cross-feature-navigation.spec.ts`.
- A direct URL paste or refresh always re-initializes correctly, since the server parses `searchParams` fresh on every request.

---

## Server/client boundary

The preferred architecture from the task was used: each route's `page.tsx` (a server component) reads Next 15's async `searchParams`, converts it to a `URLSearchParams` via `toUrlSearchParams`, and calls the same pure `parseUrlState` used client-side, producing a plain, serializable `CanonicalUrlState` passed into the client component as `initialUrlState`. The client component then owns live state via `useCanonicalUrlState`, which also reacts to `useSearchParams()` for back/forward. No `@repo/prediction-engine` import appears in any URL-state module — `validMapIds` is always derived from the `GameMap[]` prop each client already receives, matching the existing pattern documented in `ScenarioBuilder`. No hydration mismatch occurs: since the page's server render already reads `searchParams`, the route is dynamic end-to-end, and `useSearchParams()` in a descendant client component does not require an additional Suspense boundary (confirmed via a clean `next build`).

---

## Result integrity

- No prediction is ever auto-generated from URL state — verified in `e2e/cross-feature-navigation.spec.ts`.
- `PredictionResult.scenario` is the sole source for result-level links; changing simulator controls or breakdown tabs never touches them, structurally guaranteed by `AnalyticsContextLinks` living as a sibling of `PredictionResultExperience`, not a descendant of it.
- No simulated profile or simulator adjustment ever reaches the URL.

---

## Privacy note

The URL only ever carries: region ids, team ids, map ids, and a series format — all public, non-sensitive identifiers already visible in the UI. No profile values, no What-if Simulator adjustments, and no simulator results are ever serialized.

---

## Deferred to later tasks

- No database persistence, no localStorage/sessionStorage — explicitly out of scope.
- No simulation history and no sharing of What-if Simulator state across features.
- No URL state for transient UI (tabs, hover, focus) — intentional, per requirement 2.
- TASK-040 (final QA) can build on this integration but was not started here.
