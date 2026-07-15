# TASK-019

## Title

Head-to-Head & Recent Form Insights

---

## Sprint

Sprint 04

---

## Objective

Ground the generated Insights and Key Factors in the Analytics Engine's head-to-head and recent-form data, so explanations can reference concrete historical evidence rather than DNA comparison alone.

---

## Rationale

`docs/10-prediction-engine.md` lists "Historical matches" among the Prediction Engine's inputs and requires "Supporting Evidence" in every prediction's output. `docs/03-system-architecture.md` positions the Analytics Engine's outputs (Recent Form, Head-to-head) as feeding the Explainability Pipeline. Currently, `services/prediction-engine/src/lib/insights.ts` builds insights only from Team DNA and Match DNA — head-to-head record and recent-form trend, now available from TASK-017's Analytics Engine, are not referenced anywhere in the generated explanation.

---

## Implementation Requirements

- Extend `generateInsights` (`services/prediction-engine/src/lib/insights.ts`) to accept the head-to-head and recent-form data produced by TASK-017's analytics module.
- Add at least one new `Insight` (using the existing `InsightKind` values, e.g. `"advantage"` or `"deciding-factor"`) that references head-to-head record when it exists, and one that references recent form trend.
- Wire the new inputs through `computePrediction` in `generatePrediction.ts` without changing the `PredictionResult` contract shape.
- If two teams have no prior head-to-head history in the synthetic dataset, the module must omit the head-to-head insight gracefully rather than fabricate one — consistent with `docs/10-prediction-engine.md`'s "Honesty is preferred over certainty."

---

## Acceptance Criteria

- [ ] Generated insights include a head-to-head-based insight when history exists between the two selected teams.
- [ ] Generated insights include a recent-form-based insight for both teams.
- [ ] No head-to-head insight is generated when no history exists (verified by a unit test).
- [ ] `insights.test.ts` is extended to cover both new insight types.
- [ ] `e2e/prediction-studio.spec.ts` continues to pass.
- [ ] `pnpm check-types`, `pnpm lint`, and `pnpm test` pass.

---

## Dependencies

TASK-017

---

## Status

TODO

---

## Notes

Keep new insight copy consistent in tone with existing generated insights (see current `insights.ts` output) — do not introduce a new writing style or terminology outside `docs/00a-ubiquitous-language.md`.
