# What-if Simulator

Version: 1.0 (TASK-038)

---

## Purpose

Lets a user modify selected modeled team attributes for an existing Prediction Studio matchup and immediately see how those hypothetical changes would affect the prediction. It is a **scenario-analysis tool**, not a forecast: it never claims to predict real roster changes, injuries, transfers, or coaching decisions, and every result is framed as "modeled" or "simulated," never as a certainty.

Renders on `/prediction-studio`, inside `PredictionResultExperience`, immediately after the Interactive Prediction Breakdown (TASK-037) and before the existing static detail sections. It only mounts once a valid baseline `PredictionResult` exists.

---

## Baseline immutability

The baseline `PredictionResult` and the source `VctTeamProfile` registry (`VCT_TEAM_PROFILES`) are never mutated by this feature:

- `computeVctPredictionFromProfiles` — the exact math `generateVctPrediction` already used — was extracted unchanged so both the production path and the simulator call the identical formula. `generateVctPrediction.regression.test.ts` (TASK-037) still pins the production path's exact output; a new `simulateVctPrediction.test.ts` proves `VCT_TEAM_PROFILES` stays byte-identical (via a deep JSON snapshot) across dozens of varied simulations, and that a baseline prediction generated *after* a simulation is unaffected by it.
- `cloneVctTeamProfile` deep-clones a profile (including `dna.dimensions` and `mapStrength`, not just a shallow spread) before any adjustment is applied — the frozen original is never touched.
- The simulator's local `useSimulatorState` reducer is remounted (via a `key` derived from the scenario's identity) whenever the underlying scenario actually changes, giving every control a clean reset; switching TASK-037's breakdown tabs never touches this key.

---

## Adjustable attributes

`VctTeamProfile` stores 12 named numbers per team, but the prediction formula only reads 7 of them: the six Team DNA dimensions (`aggression`, `tempo`, `mapControl`, `utilityEfficiency`, `adaptability`, `clutchAbility`) and `recentFormIndex`. The other five (`attackStrength`, `defenseStrength`, `economyEfficiency`, `clutchPerformance`, `consistency`) are pre-computed aliases/composites of those same six dimensions at profile-generation time and are **not** read by `computeVctPredictionFromProfiles`.

The Controls tab exposes all 12 as real, independently adjustable sliders (never silently merged), split into two labeled groups: "Core modeled attributes" (the 7 that can move the headline probability) and "Additional profile attributes" (the 5 that are tracked and visible in the Change Breakdown, but currently inert with respect to the modeled outcome — the UI says so explicitly rather than implying a causal effect that doesn't exist).

- **Bounds**: every delta is clamped to **-15 to +15**, step **1**, enforced identically on the client (`clampDeltaValue`) and the server (`validateSimulationRequest`).
- **Map-specific adjustments**: optional, per scenario-selected map only, same bounded-delta model. `mapStrength` isn't read by the prediction formula either (it only feeds the TASK-036 Map Matchup Explorer), so map sliders are honestly labeled as tracked-only for the same reason as the five "additional" attributes.
- **Display**: every control shows baseline, current delta (with an explicit `+`/`−` sign), and the resulting simulated value — sourced from a real baseline snapshot (`/api/vct-profile-baseline`, a narrow, additive, read-only projection of `VctTeamProfile` that never exposes team id, region, archetype, `overallRating`, or maps outside the current scenario), never a placeholder number.

---

## Presets

Six deterministic presets (`SIMULATION_PRESETS`), each a fixed, documented delta set applied to one team: Improved Form, Stronger Defense, Better Economy, Clutch Boost, Aggressive Style, Balanced Upgrade. Applying a preset merges its deltas into the current draft — fields it names are replaced, everything else is untouched — and is idempotent (applying the same preset twice matches applying it once). No preset claims a roster transfer, injury recovery, coaching change, or guaranteed improvement.

---

## Isolated simulation architecture

`services/prediction-engine/src/simulateVctPrediction.ts` is the isolated engine entry point:

1. Reads baseline profiles from the frozen `VCT_TEAM_PROFILES` registry (read-only).
2. Clones and applies the validated adjustment (`applyVctProfileAdjustment` — clone-then-adjust, per-field clamped).
3. Calls `computeVctPredictionFromProfiles` — the same function the production path uses.
4. Returns a plain `PredictionResult`, never cached (deterministic for the same inputs; no need to cache, and this avoids any risk of colliding with `generateVctPrediction`'s scenario cache).

There is no module-level mutable state anywhere in this path, so concurrent simulations with different adjustment payloads can never leak into each other (`simulateVctPrediction.test.ts` proves this directly).

`validateSimulationRequest` runs the identical scenario checks as `validateVctScenario`, then validates both teams' adjustment payloads server-side regardless of client-side clamping: allowlisted fields only, finite numbers within bounds, no prototype-pollution keys (`__proto__`/`constructor`/`prototype`), no unsupported structure, and map deltas restricted to maps already in the scenario.

### API contract (additive)

- `POST /api/simulate-prediction` — `SimulationRequest` → `SimulationResult`. `/api/vct-prediction` and `PredictionResult` are untouched.
- `POST /api/vct-profile-baseline` — read-only baseline snapshot for the Controls tab, called once per mounted simulator instance.

All new types (`VctProfileAdjustment`, `SimulationRequest`, `SimulationResult`, `VctProfileBaseline`, `VctProfileScalarField`, bounds constants) live in `@repo/shared`.

---

## Simulation execution

Moving a slider only updates local draft state — no request is sent. "Run Simulation" is disabled while a request is in progress or while the draft has no changes, and fires exactly one request per press. A failed request preserves the draft and any previous successful simulation (shown with a `role="alert"` message and a retry path); a successful rerun replaces the prior simulation result rather than stacking a history.

---

## Result Comparison and Change Breakdown

Pure helpers in `apps/web/src/lib/whatIfSimulator/resultComparison.ts` diff the baseline and simulated `PredictionResult`: win-probability deltas in **percentage points** (never percent growth), a winner-changed flag, confidence/trust deltas, key-factor diffing, contribution diffing (reusing TASK-037's `buildContributionRows`), and Match DNA dimension diffing. `buildSimulationSummary` produces a neutral, deterministic sentence — "limited effect" wording below a 1-point threshold, explicit winner-change wording otherwise, always noting this reflects modeled adjustments, not a forecast.

---

## Accessibility & visual design

Native `<input type="range">` sliders (real keyboard/touch support, no custom widget) with `accent-team-a`/`accent-team-b` theming. Every slider's accessible name includes the team and attribute; every reset button's accessible name includes the team name too (two teams can share an attribute label, e.g. "Aggression," so the team name disambiguates it). Team identity is never color-only — a small colored dot sits beside plain-colored team-name text, the same WCAG-AA-safe pattern already established by `SelectedTeamSummary`/`TeamDnaCard` (`text-team-a`/`text-team-b` fails contrast at this size/weight against the surface background). Loading and error states use `role="status"`/`role="alert"`. Zero axe violations in light and dark themes.

---

## Deferred to later tasks

- **TASK-039+**: simulation history, URL state, and any cross-feature state sharing are explicitly out of scope for this task and were not started.
- Real player-transfer or injury data is out of scope by design — every preset and adjustment is a labeled hypothetical.
