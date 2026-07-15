# TASK-016

## Title

Feature-Driven Win Probability, Confidence & Trust Score

---

## Sprint

Sprint 03

---

## Objective

Replace the seeded-random win probability, confidence, and trust score calculations with values derived from the now feature-driven Team DNA and Match DNA comparison.

---

## Rationale

`docs/16-prediction-pipeline.md` (Steps 5–8) defines the pipeline as Team DNA → Match DNA → Prediction → Confidence Estimation, each step consuming the previous step's output. `docs/10-prediction-engine.md` ("Confidence Score") clarifies confidence measures certainty, not win probability, and depends on "data quality, historical consistency, feature agreement, prediction stability." `docs/00a-ubiquitous-language.md` defines Trust Score as a separate concept from Confidence, factoring in Data Quality, Feature Coverage, Pipeline Health, Confidence, and Scenario Reliability.

Today, `computePrediction` in `services/prediction-engine/src/generatePrediction.ts` derives `teamAWinProbability`, `confidence`, and `trustScore` independently from three unrelated `seededRatio` calls — Team DNA and Match DNA are computed but never actually influence the outcome. This is the final piece needed to make the documented pipeline true end to end.

---

## Implementation Requirements

- Derive win probability from the Match DNA comparison already produced by `generateMatchDna` (e.g. from the aggregated advantage of Team A's DNA dimensions over Team B's, weighted per the Feature Registry from TASK-015), replacing the `seededRatio` call currently used for `teamAWinProbability`.
- Derive `confidence` from feature agreement/stability signals available from the normalized dataset (TASK-013) and DNA comparison — e.g. how consistently a team's recent-form aggregates agree with its overall DNA — rather than a random value.
- Derive `trustScore` from the factors named in `docs/00a-ubiquitous-language.md`: data/feature coverage (did every team have sufficient normalized match history for every feature in the registry) combined with the computed `confidence`.
- Preserve the existing `PredictionResult` contract shape — no `packages/shared` changes required.
- Preserve determinism: identical scenarios must continue to produce identical results (existing caching in `cache.ts` must keep working).

---

## Acceptance Criteria

- [ ] Win probability, confidence, and trust score are computed from Team DNA/Match DNA/normalized data, not from `seededRatio`.
- [ ] `generatePrediction.test.ts` is updated with fixture-based assertions (e.g. a team with a clear DNA advantage produces a win probability above 50% for that team) and passes.
- [ ] The `warnings` message about synthetic data remains present and accurate (still synthetic data, now with real feature-driven computation on top of it).
- [ ] `e2e/prediction-studio.spec.ts` continues to pass.
- [ ] `pnpm check-types`, `pnpm lint`, and `pnpm test` pass.

---

## Dependencies

TASK-014, TASK-015

---

## Status

TODO

---

## Notes

This task closes the largest remaining gap between `docs/00-product-dna.md` Principle 2 ("Every Prediction Must Be Explainable") and the implementation. After this task, every number surfaced in Prediction Studio is traceable back to the synthetic raw dataset introduced in Sprint 02.
