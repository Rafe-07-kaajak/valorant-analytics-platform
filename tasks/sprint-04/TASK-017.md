# TASK-017

## Title

Analytics Engine — Precomputed Team Statistics

---

## Sprint

Sprint 04

---

## Objective

Compute and expose the precomputed analytics named in the System Architecture document — map win rate, recent form, head-to-head record, and round differential — as a queryable module built on the normalized dataset.

---

## Rationale

`docs/03-system-architecture.md` names the Analytics Engine as one of six core services and lists its outputs explicitly: Map Win Rate, Recent Form, Head-to-head, Round Differential, Team DNA metrics. `docs/06-data-architecture.md` (Layer 3 — Analytics Warehouse) requires these to be "generated automatically" so "no frontend request should trigger heavy analytical computation."

Sprint 03 built per-team normalized aggregates and used them for Team DNA, but there is still no head-to-head record (a two-team comparison, not a per-team aggregate) and no explicitly named, independently queryable "Map Win Rate" / "Recent Form" / "Round Differential" surface — these currently only exist implicitly inside DNA formulas. README's Phase 4 checklist lists "analytical services ⏳" as still outstanding; this task completes it.

---

## Implementation Requirements

- Add an analytics module (e.g. `services/prediction-engine/src/lib/analyticsEngine.ts`) that reads the TASK-013 normalized dataset and exposes: per-team map win rate, per-team recent form (last 5 / last 10), per-team round differential, and head-to-head record between any two teams.
- The module must be a pure read over precomputed/normalized data — no per-request heavy computation over raw match records.
- Do not change the prediction API response shape in this task; this task produces the analytics module and its tests. Consuming it in insights/UI is TASK-018 and TASK-019.

---

## Acceptance Criteria

- [ ] The analytics module exposes map win rate, recent form, round differential (per team), and head-to-head record (per team pair) with correct types.
- [ ] Head-to-head lookups are symmetric and consistent regardless of argument order (Team A vs Team B == Team B vs Team A, correctly inverted).
- [ ] Unit tests verify each analytic against a small fixed fixture derived from TASK-013's aggregates.
- [ ] `pnpm check-types`, `pnpm lint`, and `pnpm test` pass.

---

## Dependencies

Sprint 03 TASK-013

---

## Status

TODO

---

## Notes

This module intentionally mirrors the "Analytics Engine" responsibility boundary from `docs/03-system-architecture.md` and `docs/05-domain-model.md` ("Analytics operates alongside the Prediction pipeline") without introducing a separate networked service — Version 1's backend remains in-process per the current architecture.
