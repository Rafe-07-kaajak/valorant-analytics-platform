# TASK-012

## Title

Raw Data Validation Layer

---

## Sprint

Sprint 02

---

## Objective

Implement a validation stage over the raw match history dataset (TASK-011) that quarantines invalid records instead of allowing them into downstream analytics, matching the documented Data Cleaning/Validation stage.

---

## Rationale

`docs/06-data-architecture.md` ("Data Validation") requires every imported record to pass validation for missing fields, duplicate IDs, invalid timestamps, unknown teams, invalid maps, and broken relationships, and states plainly: "Invalid records are quarantined. They are never used for analytics." `docs/08-ai-pipeline.md` (Stage 2 — Data Cleaning) and `docs/15-data-architecture.md` ("Validated Data") describe the same requirement: validation confirms required information exists without inventing missing information, and failures should not silently corrupt downstream data.

No such validation exists today — the current dataset is a static, always-valid array. Once TASK-011 introduces a larger generated dataset, an explicit validation stage is needed so the pipeline behaves the way the documentation requires, and so later stages (normalization, feature engineering) can trust their input without re-implementing checks.

---

## Implementation Requirements

- Add a validation module (e.g. `services/prediction-engine/src/lib/validateMatchHistory.ts`) that takes the raw match history dataset from TASK-011 and returns a result distinguishing valid records from quarantined (invalid) records.
- Validation checks must cover, at minimum: required fields present, known team ID, known map ID, valid/non-future timestamp, no duplicate match IDs.
- Invalid records must never throw — they are collected as quarantined output with a reason, per the "graceful degradation" philosophy in `docs/06-data-architecture.md` and `docs/14-backend-architecture.md`.
- Do not wire this into the prediction request path yet; this task produces the validation function and its tests only.

---

## Acceptance Criteria

- [ ] A validation function exists that partitions the raw dataset into valid and quarantined records with reasons.
- [ ] Each documented validation rule (missing fields, duplicate IDs, invalid timestamps, unknown teams, invalid maps) has a corresponding unit test that exercises it.
- [ ] Running validation against the TASK-011 dataset (which is generated to be valid) produces zero quarantined records, proving the generator and validator agree on shape.
- [ ] A deliberately malformed fixture record is quarantined, not thrown as an exception.
- [ ] `pnpm check-types`, `pnpm lint`, and `pnpm test` pass.

---

## Dependencies

TASK-011

---

## Status

TODO

---

## Notes

Keep this stage narrowly scoped to validation only. Normalization (standardizing identifiers/formats) belongs to Sprint 03, per the layer separation in `docs/06-data-architecture.md` and `docs/15-data-architecture.md`.
