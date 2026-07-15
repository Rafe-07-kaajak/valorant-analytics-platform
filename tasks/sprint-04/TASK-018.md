# TASK-018

## Title

Feature Contribution Module

---

## Sprint

Sprint 04

---

## Objective

Add a "Feature Contribution" module to the Prediction Result Experience that visualizes each key factor's magnitude and direction of influence on the prediction.

---

## Rationale

`docs/02-information-architecture.md` lists "Feature Contribution" as one of the named Prediction Studio Modules, alongside Prediction Result, Confidence, Explanation, and Probability Timeline. `docs/10-prediction-engine.md` requires every prediction to surface "Top Influencing Factors" so users "understand what influenced the prediction, which factors were most important."

The underlying data already exists: `KeyFactor` (`packages/shared/src/types/insight.ts`) already carries `impact` (positive/negative) and `magnitude`, and `KeyFactorsList` already renders them as a plain list. What is documented but missing is a dedicated visual "Feature Contribution" module — the list view does not communicate relative magnitude at a glance. This task is a visualization task, not a new data source, per the reuse-before-creation rule.

---

## Implementation Requirements

- Add a `FeatureContribution` component under `apps/web/src/features/insights/` that visualizes `result.keyFactors` (magnitude and impact direction) using an existing `@repo/ui` chart primitive (e.g. `SplitBar` or `Meter`, both already present in `packages/ui/src/components`).
- Compose it into `PredictionResultExperience.tsx`, positioned near the existing `KeyFactorsList` so the two views reinforce each other rather than duplicate.
- Do not add new fields to `KeyFactor` or `PredictionResult` — reuse the existing `magnitude`/`impact` fields exactly as they are.
- Follow existing motion and accessibility patterns used by sibling insight components (labeled chart elements, sufficient contrast).

---

## Acceptance Criteria

- [ ] A `FeatureContribution` module renders in the Prediction Result Experience, visualizing every entry in `result.keyFactors`.
- [ ] Positive and negative impact factors are visually distinguishable.
- [ ] The module is responsive and keyboard-accessible (each factor is reachable and its value is exposed to assistive technology, e.g. via `aria-label` or visible text alongside the visual bar).
- [ ] No changes to `packages/shared` types.
- [ ] `e2e/prediction-studio.spec.ts` is updated to assert the module renders after a prediction completes.
- [ ] `pnpm lint`, `pnpm check-types`, and `pnpm build` pass.

---

## Dependencies

Sprint 03 TASK-016

---

## Status

TODO

---

## Notes

`docs/02-information-architecture.md` also names "Probability Timeline," "Monte Carlo," "Scenario History," and "Quick Compare" as Prediction Studio modules. Those are out of scope for this task and are not covered elsewhere in Sprints 02–06 — they require product decisions (e.g. what a Monte Carlo simulation means for a heuristic, non-ML engine) not yet resolved in documentation, and should be raised as a backlog item rather than implemented speculatively.
