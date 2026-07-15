# TASK-021

## Title

Keyboard Navigation Pass — Prediction Studio

---

## Sprint

Sprint 05

---

## Objective

Implement the documented keyboard interaction model across Prediction Studio: logical tab order, visible focus indicators, Enter-to-activate, Escape-to-dismiss, and arrow-key navigation for ordered selection lists.

---

## Rationale

`docs/20-prediction-studio-experience.md` is a locked specification requiring Prediction Studio to "remain fully usable without relying exclusively on a mouse," with specific rules: Tab follows visual hierarchy, every interactive element shows a clear focus indicator, Enter activates the focused primary action (selecting a match, starting a prediction, expanding a result), Escape dismisses temporary elements (dialogs, dropdowns, overlays) without discarding important input, and arrow keys navigate ordered content (selectable lists, comparison tabs). `docs/21-quality-checklist.md` lists keyboard navigation and visible focus indicators as mandatory, not optional.

This corresponds to README's Phase 5 ("Polish & Optimization") objective of accessibility improvements, which has not yet started.

---

## Implementation Requirements

- Audit and fix tab order across `ScenarioBuilder`, `TeamSelector`, `MapSelector`, and the Prediction Result Experience components so it follows visual/reading order.
- Ensure every interactive element (buttons, selectable team/map items, tooltips, any `Modal`/`Dialog`/`Drawer` instances from `packages/ui`) has a visible, consistent focus style, reusing the existing design-token-based focus treatment rather than introducing a new one.
- Ensure Enter activates the currently focused primary action (e.g. running a prediction, selecting a team/map).
- Ensure Escape dismisses any open overlay component (`Modal`, `Dialog`, `Drawer`, `Tooltip`) without discarding scenario selections already made.
- Add arrow-key navigation to `TeamSelector` and `MapSelector` list items, consistent with "arrow keys navigate components that naturally represent ordered content."

---

## Acceptance Criteria

- [ ] Every interactive element in Prediction Studio is reachable via Tab in a logical order.
- [ ] Every interactive element shows a visible focus indicator.
- [ ] Enter activates the focused primary action in the scenario builder and result views.
- [ ] Escape closes any open overlay without discarding scenario state.
- [ ] Arrow keys move selection within `TeamSelector` and `MapSelector`.
- [ ] Manual verification performed in a real browser (per CLAUDE.md UI verification requirement) for the golden path (select two teams, select maps, run prediction, view result) using keyboard only.
- [ ] `pnpm lint`, `pnpm check-types`, and `pnpm build` pass.

---

## Dependencies

None

---

## Status

TODO

---

## Notes

`docs/20-prediction-studio-experience.md` mentions "Ctrl + K for global search" as a potential shortcut. No search feature exists anywhere in the current product (search is not part of the current Information Architecture implementation), so this shortcut is explicitly out of scope for this task.
