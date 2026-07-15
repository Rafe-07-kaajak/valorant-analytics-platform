# TASK-023

## Title

Landing Rhythm & Section Timing Verification

---

## Sprint

Sprint 05

---

## Objective

Verify and tune the landing page's scroll-triggered reveal timing and spacing against the documented per-section engagement targets and "one major idea per viewport" rule.

---

## Rationale

`docs/19-landing-experience.md` assigns each landing section an expected engagement window (Hero 3–5s, Product Story 10–15s, Core Features 15–20s, Prediction Studio Preview 20–30s, Technology 10–15s, Final CTA 5–10s) and a required reading rhythm alternating "high information density → visual breathing space → interaction → reflection → next discovery." It also states: "Users should never encounter multiple major ideas within a single viewport."

TASK-009 (Sprint 02) added the previously-missing Prediction Studio Preview section. This task closes the loop by verifying the full section sequence — including the new section — against the documented rhythm, since a section added in isolation can still break the page's overall pacing.

---

## Implementation Requirements

- Review each landing section's scroll-reveal trigger points, spacing, and viewport density against `docs/19-landing-experience.md`.
- Adjust `ScrollReveal` usage, inter-section spacing, and animation timing only — do not add, remove, or reorder sections beyond what TASK-009 already established.
- Verify no single viewport presents more than one major idea at typical desktop and mobile viewport heights.
- Verify the page's total scroll pacing does not feel rushed or sluggish relative to the documented per-section engagement windows.

---

## Acceptance Criteria

- [ ] Every landing section's reveal timing and spacing has been checked against `docs/19-landing-experience.md`.
- [ ] Any section found to violate the "one major idea per viewport" rule is adjusted.
- [ ] Motion timing/easing remains consistent across all sections (no section feels visually inconsistent with its neighbors).
- [ ] Manual verification performed in a real browser at desktop, tablet, and mobile viewport widths.
- [ ] `e2e/landing.spec.ts` continues to pass.
- [ ] `pnpm lint`, `pnpm check-types`, and `pnpm build` pass.

---

## Dependencies

Sprint 02 TASK-009

---

## Status

TODO

---

## Notes

This is a tuning task, not a redesign — reuse the existing `ScrollReveal` component and motion tokens established in Sprint 01 (`docs/18-design-direction.md`) rather than introducing new animation primitives.
