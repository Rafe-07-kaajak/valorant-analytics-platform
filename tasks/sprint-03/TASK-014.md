# TASK-014

## Title

Feature Engineering — Behavioral Team DNA

---

## Sprint

Sprint 03

---

## Objective

Replace the seeded-random generation of Team DNA dimensions with real calculations derived from the normalized dataset, so every DNA value is traceable to a measurable statistic.

---

## Rationale

`docs/10-prediction-engine.md` ("Feature Extraction") gives explicit mappings that raw statistics must transform into: Entry Success → Aggression, Utility Usage → Utility Efficiency, Economy History → Economy Discipline, Recent Results → Momentum. `docs/16-prediction-pipeline.md` (Step 4 and 5) requires Team DNA to be generated from extracted features, not from an arbitrary source. `docs/00-product-dna.md` Principle 2 states explicitly that black-box predictions are not acceptable.

Today, `generateTeamDna` (`services/prediction-engine/src/lib/teamDna.ts`) computes every dimension (aggression, tempo, mapControl, utilityEfficiency, adaptability, clutchAbility) purely from `seededRatio(...)` — a hash with no relationship to any statistic. This is the single largest gap between the documented product ("Insight Before Prediction," explainable-by-construction DNA) and the current implementation, and it is exactly what README's Phase 4 "analytical services ⏳" line refers to.

---

## Implementation Requirements

- Replace the body of `generateTeamDna` in `services/prediction-engine/src/lib/teamDna.ts` so each of the six existing dimensions is computed from the normalized aggregates produced in TASK-013, using a documented, explainable formula for each (e.g. aggression from entry/first-kill success rate, economy-adjacent dimensions from economy outcome rates, clutch ability from clutch conversion rate, adaptability from map win-rate spread, tempo from average round length/differential, map control from round win rate).
- Preserve the existing `TeamDna` / `DnaDimensionScore` contract shape exactly — no `packages/shared` type changes required.
- Keep dimension values within the same documented range/scale currently used (0–100) so downstream consumers (Match DNA, UI charts) require no changes.
- Where a team has insufficient normalized data for a dimension, degrade gracefully (documented fallback behavior) rather than throwing — this will be revisited by TASK-016's confidence handling, but must not crash prediction generation in this task.

---

## Acceptance Criteria

- [ ] Every DNA dimension for every team is computed from the TASK-013 normalized dataset, not from `seededRatio`.
- [ ] `generatePrediction` and the existing prediction API route continue to function end to end without contract changes.
- [ ] Existing unit tests in `teamDna.test.ts` are updated to assert dimension values against known fixture aggregates rather than fixed seeded constants, and pass.
- [ ] `e2e/prediction-studio.spec.ts` continues to pass.
- [ ] `pnpm check-types`, `pnpm lint`, and `pnpm test` pass.

---

## Dependencies

TASK-013

---

## Status

TODO

---

## Notes

`seededRatio` remains a legitimate utility for anything genuinely presentation-random (e.g. pipeline stage duration flavor in `pipeline.ts`); this task only removes it from the statistical DNA calculation, not from the codebase.
