# TASK-024

## Title

Accessibility Test Coverage Expansion

---

## Sprint

Sprint 05

---

## Objective

Extend the existing Playwright + axe-core end-to-end suite to cover keyboard navigation flows and to run accessibility checks against the post-prediction result state, not only initial page load.

---

## Rationale

`docs/21-quality-checklist.md` requires accessibility verification (keyboard navigation, focus indicators, contrast, semantic structure) as mandatory, and README documents `pnpm test:e2e` as running "Playwright + axe-core end-to-end and accessibility tests." The current suite (`e2e/landing.spec.ts`, `e2e/prediction-studio.spec.ts`) exists but was written before TASK-021's keyboard navigation work and before Sprint 04's new UI additions (Feature Contribution module, Confidence/Trust Score explanation) — none of that surface currently has automated accessibility coverage.

---

## Implementation Requirements

- Extend `e2e/prediction-studio.spec.ts` to run an axe-core scan against the Prediction Result Experience after a prediction completes, not only the empty scenario-builder state.
- Add Playwright test coverage exercising the keyboard flows implemented in TASK-021 (tab order reaches the run-prediction action, Enter runs it, Escape dismisses an open overlay, arrow keys move selection).
- Keep new tests consistent with the existing spec file structure and assertions style.
- Do not introduce a new testing framework or library — reuse the existing `@axe-core/playwright` and `@playwright/test` setup.

---

## Acceptance Criteria

- [ ] An axe-core scan runs against the rendered Prediction Result Experience and reports zero critical/serious violations.
- [ ] A Playwright test exercises the full keyboard-only golden path (select teams, select maps, run prediction, view result) without using pointer input.
- [ ] A Playwright test verifies Escape dismisses an open overlay.
- [ ] `pnpm test:e2e` passes locally.

---

## Dependencies

TASK-021

---

## Status

TODO

---

## Notes

Any accessibility violation surfaced by this expanded coverage that is reproducible should be fixed as part of TASK-022 or this task — do not merge tests that are expected to fail.
