# Team Comparison Lab

Version: 1.0 (TASK-035)

---

## Purpose

Lets a user pick any two of the 32 VCT Stage 1 teams and compare their modeled profiles directly — ratings, Team DNA, map strength, and the most significant differences between them — without generating a match prediction first. It is a distinct analytics tool from Prediction Studio: no series format, no map-pool selection, no submit step. The comparison updates instantly as soon as both teams are selected.

Route: `/team-comparison`. Nav label: "Comparison Lab".

---

## Data source

Server-resolved only. `app/team-comparison/page.tsx` imports `VCT_TEAM_PROFILES`, `VCT_PROFILE_DISCLOSURE`, and `maps` from `@repo/prediction-engine`, and `VCT_REGIONS`/`VCT_TEAMS` from the web app's own directory, then passes them as plain serializable props into `TeamComparisonClient` ("use client"). The client component never imports `@repo/prediction-engine` itself — only `import type { VctTeamProfile }` (erased entirely at compile time, so none of the engine's Node-only modules reach the browser bundle, the same constraint Prediction Studio's `ScenarioBuilder` already documents).

All comparison-specific derivation (metric differences, factor derivation, map comparison, the neutral summary) is new pure logic in `apps/web/src/lib/teamComparison/`, operating on the already-resolved profile data — it does not call `previewVctMatchup`/`generateMatchDna` from the engine, and does not reimplement TASK-031's profile-generation formulas (only trivial aggregation — min/max/mean/stdev — over already-generated numbers).

---

## Four tabs (`@repo/ui`'s `Tabs` primitive — its first real consumer)

- **Overview** — paired 0-100 metrics as `SplitBar`s (overall rating, recent form, attack/defense strength, economy, clutch, consistency), round differential as a signed compact stat (negative values aren't representable by `SplitBar`), and a strongest/weakest map card per team.
- **Team DNA** — `DnaComparisonRadar` plus an always-visible table carrying the same six dimension values as a text alternative, and a three-column "stronger for A / stronger for B / balanced" breakdown.
- **Maps** — every supported map's modeled strength for both teams (`SplitBar` per row), plus most-even-map and largest-gap-map summary cards. No map-selection controls — that's TASK-036.
- **Factors** — up to 8 derived factors (aggression, map control, adaptability, economy, clutch, consistency, attack/defense balance, map-pool depth), sorted by magnitude, each with a neutral, deterministic description.

Selection state lives above the `Tabs` component, so switching tabs never loses the selected pair or recomputes anything.

---

## Disclosure

`VCT_PROFILE_DISCLOSURE` is reused verbatim except its leading verb phrase, adapted via `adaptDisclosureForComparison()` ("Predictions use" → "This comparison uses") rather than duplicating the sentence.

---

## Deferred to later tasks

- **TASK-036**: map-selection controls on the Maps tab (currently a full-roster overview only).
- **TASK-037**: interactive chart redesign (the radar chart itself is unchanged from Prediction Studio; only a text-alternative table was added alongside it here).
- **TASK-039**: cross-feature state sharing/navigation (e.g. carrying a selected pair from this page into Prediction Studio) — the two pages' selection state is currently fully independent.
