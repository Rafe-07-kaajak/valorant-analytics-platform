# TASK-020

## Title

Confidence vs. Trust Score Explanation

---

## Sprint

Sprint 04

---

## Objective

Add a small, dynamically-sourced explanation distinguishing Confidence from Trust Score in the Prediction Result Experience, since the two are officially distinct concepts that are easy to confuse.

---

## Rationale

`docs/00a-ubiquitous-language.md` defines Confidence and Trust Score as explicitly different concepts ("Confidence and Trust Score are different concepts") and warns against treating them as synonyms. `docs/10-prediction-engine.md` reinforces this with a concrete example: "Win Probability 67%, Confidence 91% — a close match can still have high confidence." Both values are already displayed in `PredictionSummary.tsx`, but neither is explained, so a user has no way to understand why the two numbers can diverge.

This task follows directly from Sprint 03 TASK-016, which made both values genuinely derived from feature coverage and agreement rather than random — meaning there is now real, data-driven reasoning to surface, not just a definitional tooltip.

---

## Implementation Requirements

- Add a short explanatory affordance (e.g. an info tooltip or inline expandable note, reusing the existing `@repo/ui` `Tooltip` component) near the confidence and trust score display in `PredictionSummary.tsx`.
- The explanation text must be sourced from the actual computed basis for each score (e.g. "Confidence reflects X; Trust Score additionally reflects feature coverage of Y%"), using data already present on `PredictionResult` after TASK-016 — not a static, generic string.
- Keep the interaction consistent with `docs/20-prediction-studio-experience.md` keyboard/focus requirements (the tooltip must be reachable and dismissible via keyboard).

---

## Acceptance Criteria

- [ ] Confidence and Trust Score each have an accessible explanation reachable by keyboard and mouse.
- [ ] Explanation content reflects the actual computed inputs from TASK-016, not a hardcoded string.
- [ ] The tooltip/affordance is dismissible via Escape and does not trap focus.
- [ ] `e2e/prediction-studio.spec.ts` is extended to assert the explanation is reachable.
- [ ] `pnpm lint`, `pnpm check-types`, and `pnpm build` pass.

---

## Dependencies

Sprint 03 TASK-016

---

## Status

TODO

---

## Notes

Reuse the existing `Tooltip` component from `packages/ui` rather than building a new disclosure pattern — `docs/13-frontend-architecture.md` and CLAUDE.md both require searching for and reusing existing components before creating new ones.
