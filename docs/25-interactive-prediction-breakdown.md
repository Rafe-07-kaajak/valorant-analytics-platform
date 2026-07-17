# Interactive Prediction Breakdown

Version: 1.0 (TASK-037)

---

## Purpose

Turns a Prediction Studio result into an explorable breakdown of how each modeled factor shaped the final probability — without changing the prediction itself. The underlying `PredictionResult` produced by `@repo/prediction-engine` is untouched; this feature is a presentation layer built entirely from data the engine already returns.

Renders on `/prediction-studio`, inside `PredictionResultExperience`, immediately after `PredictionSummary` and alongside the existing Match DNA / explanation / key factors / feature contribution / insights sections — none of which were removed or restructured.

---

## Data flow

All derivation lives in `apps/web/src/lib/predictionBreakdown/` — pure, deterministic functions operating on an already-computed `PredictionResult`:

- `contributions.ts` — ranks `keyFactors` by magnitude and computes each one's percentage share of the total absolute magnitude across all factors (a share of the *modeled gap*, not of the win probability itself).
- `dnaGaps.ts` — reuses TASK-035's `compareDnaDimensions` to build a per-dimension Team A/B comparison, plus a short deterministic sentence naming the largest gaps.
- `factorLinks.ts` — the cross-tab mapping layer. `KeyFactor.id` is generated server-side as the source `DnaDimensionKey` string, so a key factor, its contribution row, and its Team DNA dimension are the same entity under the same id — these are exact-match lookups, not fuzzy heuristics, and return `null` rather than guessing when no match exists.
- `explanationLinks.ts` — splits `result.explanation` into sentences and links each one to a dimension only when it deterministically matches the engine's own known sentence templates (the top key factor's label, or the decisive dimension's label). A test proves the split fragments rejoin to the exact original string.
- `pipelineView.ts` — builds a view-model over `result.pipeline`, labeling which downstream concern each of the engine's fixed 9 stages feeds, derived from that stage's own description text.

None of these modules call into `@repo/prediction-engine` or regenerate any value — every number displayed is the same number the engine produced.

---

## Four tabs (`@repo/ui`'s `Tabs` primitive)

- **Contributions** — every key factor as a ranked, diverging bar (`FeatureContributionChart`), direction shown by both color and an arrow icon, each row a real `<button>` with a full accessible name.
- **Match DNA** — the existing, unmodified `DnaComparisonRadar` alongside a new interactive paired-metric table (also the radar's required text alternative); selecting a row highlights the same dimension everywhere else in the breakdown.
- **Key Factors** — `result.keyFactors` rendered exactly as generated; selecting one cross-highlights its linked Contributions row and Match DNA dimension via `factorLinks.ts`, or renders standalone when no link exists.
- **Pipeline** — the engine's 9 real stages in their original order; selecting a stage reveals its real duration and "affects" tags (genuine data, not fabricated detail).

## Cross-highlighting state

One small `useReducer` hook, `useBreakdownState` (`features/prediction-studio/breakdown/useBreakdownState.ts`), owned by `PredictionResultExperience` and passed down to `InteractivePredictionBreakdown` and `ExplanationCard`. It is not part of `PredictionResult`, not global, and not URL state.

A single `selectedDimension`/`hoveredDimension` pair drives all three dimension-keyed tabs (contribution, DNA row, key factor share one id, per `factorLinks.ts`); a separate `selectedStage`/`hoveredStage` pair drives the Pipeline tab. Hovering shows a value immediately; clicking or pressing Enter/Space persists a selection that survives the pointer leaving; Escape clears it.

## Explanation highlighting

`ExplanationCard` gained optional props (`fragments`, `activeDimensionKey`, `selectedDimensionKey`, hover/select callbacks). Omitted, it renders exactly as before — one plain paragraph. Provided, each sentence renders individually, and sentences deterministically linked to a dimension become keyboard-reachable buttons that react to the shared breakdown state. The visible text is identical either way.

---

## Guarantees

- `generateVctPrediction.regression.test.ts` pins the exact output of a fixed scenario (outcomes, confidence, trust score, Team DNA, Match DNA, key factors, insights, explanation text) to prove this feature made no change to the prediction algorithm.
- 38 unit tests across the `predictionBreakdown` helpers, 7 for the reducer hook, and 12 component tests cover determinism, cross-highlighting, keyboard access, and the empty/partial-data paths.
- `e2e/prediction-breakdown.spec.ts` covers the golden path, all four tabs, keyboard-driven cross-highlighting, Escape-to-clear, mobile layout, and light/dark accessibility with zero axe violations.

## Deferred to later tasks

- **TASK-038+**: anything beyond a read-only breakdown (e.g. a What-if Simulator) is explicitly out of scope for this task and was not started.
