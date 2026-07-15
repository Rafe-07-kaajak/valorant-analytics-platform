# TASK-009

## Title

Prediction Studio Preview Section (Landing)

---

## Sprint

Sprint 02

---

## Objective

Add the missing "Prediction Studio Preview" section to the landing page so the page matches the documented Information Architecture and Landing Experience specifications.

---

## Rationale

`docs/02-information-architecture.md` defines the Landing page section order as Hero → Interactive Demo → Why This Product Exists → Core Features → Supported Tournaments → Call To Action → Footer. `docs/19-landing-experience.md` independently specifies a "Prediction Studio Preview" section (20–30 second engagement target) as "the emotional peak of the landing page," positioned to generate excitement before the Technology/Final CTA section.

The current landing page (`apps/web/src/app/page.tsx`) only composes Hero → ProductStory → CoreFeatures → SupportedTournaments → FinalCta. No section previews Prediction Studio. This is a documented gap left over from Sprint 01, not a new feature — it does not expand product scope, it completes an already-specified section.

---

## Implementation Requirements

- Add a new `PredictionStudioPreview` component under `apps/web/src/features/landing/`.
- Position it after `CoreFeatures` and before `SupportedTournaments`, consistent with the emotional-peak placement described in `docs/19-landing-experience.md`.
- The section should visually preview the Prediction Studio experience (e.g. a static or lightly animated glimpse of the scenario builder and/or a prediction result) and link to `/prediction-studio`.
- The section must not perform a real prediction request — it is a marketing preview, not a functional instance of Prediction Studio.
- Reuse existing `@repo/ui` primitives and the existing motion/reveal patterns already used by sibling landing sections (e.g. `ScrollReveal`).
- Follow the existing landing section file structure and naming conventions (`docs/12-repository-structure.md`).

---

## Acceptance Criteria

- [ ] A `PredictionStudioPreview` section exists and is composed into `apps/web/src/app/page.tsx` between Core Features and Supported Tournaments.
- [ ] The section is responsive across mobile, tablet, and desktop breakpoints.
- [ ] The section's motion is consistent with existing landing sections (duration, easing, trigger pattern).
- [ ] The section links to `/prediction-studio`.
- [ ] No prediction API calls are made from the landing page.
- [ ] `pnpm lint`, `pnpm check-types`, and `pnpm build` pass.
- [ ] `e2e/landing.spec.ts` is updated to assert the new section renders.

---

## Dependencies

None

---

## Status

TODO

---

## Notes

Do not build the "Interactive Demo" as a fully interactive scenario builder — `docs/19-landing-experience.md` frames this section as generating excitement and imagination, not as a functional duplicate of Prediction Studio. Keep it presentational.
