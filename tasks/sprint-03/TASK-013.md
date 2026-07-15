# TASK-013

## Title

Normalization Layer

---

## Sprint

Sprint 03

---

## Objective

Convert validated raw match records (Sprint 02) into a consistent, aggregated internal representation per team and map, forming Layer 2 (Normalized Database) of the documented data architecture.

---

## Rationale

`docs/06-data-architecture.md` (Layer 2 — Normalized Database) and `docs/15-data-architecture.md` ("Normalized Data") both require a standardization step between validated raw records and feature engineering: standardized identifiers, unified naming, consistent formats, without changing the meaning of the original data. `docs/08-ai-pipeline.md` (Stage 3 — Normalization) and Stage 4 (Aggregation) describe producing historical summaries such as last-5/last-10 match form, map win rate, and average statistics.

TASK-011/012 (Sprint 02) produced and validated raw per-match records. Feature engineering (TASK-014) needs per-team, per-map aggregates rather than individual match rows — this task is the missing bridge between them.

---

## Implementation Requirements

- Add a normalization module (e.g. `services/prediction-engine/src/lib/normalizeMatchHistory.ts`) that consumes only the validated records from TASK-012 (quarantined records must never reach this stage).
- Produce per-team aggregates required by later feature work: recent form (last 5 / last 10 results), per-map win rate, average round differential, economy outcome rates, entry/first-kill success rate, clutch conversion rate.
- Keep the normalized output deterministic and traceable back to the validated input it was derived from, per the traceability requirement in `docs/06-data-architecture.md`.
- Do not change `teamDna.ts` or `generatePrediction.ts` in this task — this task produces the normalized aggregates only; consuming them is TASK-014.

---

## Acceptance Criteria

- [ ] A normalization function exists that turns validated match records into per-team, per-map aggregates covering all statistics listed above.
- [ ] Quarantined records (from TASK-012) are excluded from every aggregate.
- [ ] Unit tests verify at least one aggregate calculation by hand against a small fixed fixture dataset.
- [ ] Output is deterministic across repeated runs given the same input.
- [ ] `pnpm check-types`, `pnpm lint`, and `pnpm test` pass.

---

## Dependencies

TASK-011, TASK-012

---

## Status

TODO

---

## Notes

This aggregate output is what TASK-014 will read from. Keep the module's public shape stable and well-typed so it can serve as a dependable input contract for feature engineering.
