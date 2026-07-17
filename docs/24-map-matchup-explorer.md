# Map Matchup Explorer

Version: 1.0 (TASK-036)

---

## Purpose

Lets a user select any two of the 32 VCT Stage 1 teams and inspect their modeled matchup across the full supported map pool — which maps favor which side, which are close, why each map leans one way, and how a selected subset of maps changes the overall picture. Goes deeper than TASK-035 Team Comparison Lab's Maps tab, which only shows a flat per-map overview with no ranking, no explanations, and no pool aggregation.

Route: `/map-matchup`. Nav label: "Map Explorer".

---

## Data source

Server-resolved only, identical pattern to Team Comparison Lab: `app/map-matchup/page.tsx` imports `VCT_TEAM_PROFILES`, `VCT_PROFILE_DISCLOSURE`, and `maps` from `@repo/prediction-engine` and `VCT_REGIONS`/`VCT_TEAMS` from the web directory, passing them as plain serializable props into `MapMatchupClient` ("use client"). The client component imports profile-shaped types only with `import type` — no runtime `@repo/prediction-engine` code, and therefore no `node:crypto`, ever reaches the browser bundle.

All map-matchup-specific logic (`apps/web/src/lib/mapMatchup/`) is pure and reuses TASK-035's `lib/teamComparison` primitives (`classifyDifference`, `compareMaps`, `PERCENT_SCALE_THRESHOLDS`) rather than duplicating them — it only adds concepts TASK-035 doesn't have: ranking with multiple deterministic sort modes, pool selection helpers, pool aggregation, and per-map explanation generation.

---

## Three views (`@repo/ui`'s `Tabs` primitive)

- **Map Ranking** — every supported map, sorted by one of five deterministic modes (largest gap, closest, map name, Team A strength, Team B strength), each row showing both teams' scores, the classified advantage, and whether it's in the selected pool. Clicking or focusing a row sets it as the active map for the Map Detail view.
- **Selected Pool** — aggregate picture across whichever maps are selected: average strength per team, aggregate advantage, per-side favor counts, strongest/closest/largest-gap maps *within the pool*, and a neutral one-sentence summary. Shows a dedicated empty state when no maps are selected yet, without blocking the Map Ranking view.
- **Map Detail** — a focused panel for one map: scores, advantage, a 2-sentence deterministic explanation, and paired supporting metrics (attack/defense/economy/clutch/consistency plus the six Team DNA dimensions). Falls back to the first-ranked map once both teams are selected if nothing has been explicitly chosen yet, or if the previously active map ever disappears from the ranking.

Team selection, map pool selection, sort mode, and the active map all live above the `Tabs` component, so switching tabs never loses or recomputes any of it.

---

## Map selection semantics

The map pool (`Select All` / `Clear` / `Close Maps` / per-map toggle buttons) is a plain **inclusion filter**, not a veto/pick simulator — zero or more maps may be selected, in any combination, with no ban/pick order and no tournament-format rules attached. "Close Maps" selects exactly the maps classified `tier: "none"` (close/even) for the current pair — a deterministic reuse of the same threshold bands as everything else, not a new concept.

---

## Aggregate summary

`computePoolAggregate()` averages modeled strength across the selected maps and classifies the *aggregate* gap with the same `classifyDifference()` used everywhere else. `generatePoolSummary()` turns that into one neutral sentence (e.g. "The selected 5-map pool slightly favors G2 Esports overall, with 2 maps favoring Paper Rex, 3 favoring G2 Esports, and 1 close matchup.") — no win probability, no veto language, no outcome guarantee.

---

## Disclosure

Reuses `adaptDisclosureForComparison()` from TASK-035 verbatim — no new disclosure text was introduced.

---

## Deferred to later tasks

- **TASK-037**: interactive chart redesign — nothing here adds new chart interactivity beyond what TASK-035 already has (`SplitBar`/`Meter`, unchanged).
- **TASK-038**: What-if Simulator.
- **TASK-039**: cross-feature state sharing (e.g. carrying a selected pair or pool from this page into Prediction Studio or Team Comparison Lab) — this page's state is fully independent from both.
