# TASK-011

## Title

Synthetic Match History Dataset (Raw Data Layer)

---

## Sprint

Sprint 02

---

## Objective

Introduce a synthetic per-team match history dataset that represents Layer 1 (Raw Storage) of the documented data architecture, providing the foundation later sprints will use to replace random Team DNA generation with real feature engineering.

---

## Rationale

`docs/06-data-architecture.md` (Layer 1 — Raw Storage) and `docs/15-data-architecture.md` (Raw Data ownership) both describe raw match data as the immutable foundation every downstream layer (normalization, features, prediction) must derive from. `docs/08-ai-pipeline.md` (Stage 1) lists the expected raw record categories: professional matches, map results, tournament results, agent picks, economy statistics.

The current `services/prediction-engine/src/data/teams.ts` contains only static team identity (id, name, region, logo) — there is no match history at all. `generateTeamDna` (`services/prediction-engine/src/lib/teamDna.ts`) currently produces every DNA dimension from `seededRatio`, a deterministic hash with no relationship to any underlying statistic. This directly conflicts with `docs/00-product-dna.md` Principle 2 ("Every Prediction Must Be Explainable... Black-box predictions are not acceptable") and `docs/10-prediction-engine.md` ("Feature Extraction" section), which require DNA dimensions to originate from measurable statistics.

The README already documents this gap explicitly: "data pipeline ⏳ (synthetic data only — no live source connected)." This task does not connect a live data source (out of scope for Version 1 per current architecture); it builds the synthetic raw layer the documented pipeline requires.

---

## Implementation Requirements

- Add a new data module (e.g. `services/prediction-engine/src/data/matchHistory.ts`) containing synthetic raw match records for each of the 8 existing teams, covering the 8 existing maps (`services/prediction-engine/src/data/maps.ts`).
- Each raw match record should carry the fields needed by later feature engineering, per `docs/10-prediction-engine.md` and `docs/08-ai-pipeline.md`: teams involved, map, round outcome counts, first-kill/entry outcomes, economy outcome (eco/force/full-buy results), clutch outcomes, and a match timestamp.
- Generation must be deterministic (seeded, reusing the existing `seededRatio` utility or an equivalent seeded approach) so the dataset — and everything built on it — remains reproducible across runs and CI.
- Clearly label the dataset as synthetic in code comments/naming, consistent with the existing `warnings` message already surfaced in `PredictionResult`.
- Do not wire this dataset into `generatePrediction.ts`, `teamDna.ts`, or any API route yet — feature engineering that consumes it is Sprint 03 scope.

---

## Acceptance Criteria

- [ ] A typed raw match history dataset exists, covering every team and a representative set of maps and outcomes.
- [ ] Dataset generation is deterministic — running the generator twice produces identical output.
- [ ] Unit tests verify dataset shape (required fields present, valid team/map references, no duplicate match IDs).
- [ ] No existing prediction output changes (this task adds a dataset without wiring it in).
- [ ] `pnpm check-types`, `pnpm lint`, and `pnpm test` pass.

---

## Dependencies

None

---

## Status

TODO

---

## Notes

This task intentionally stops at raw data. Validation (TASK-012), normalization, and feature engineering (Sprint 03) are separate tasks so each stage of the documented pipeline (`docs/08-ai-pipeline.md`) remains independently reviewable, matching the "each stage must be independently testable and independently replaceable" engineering rule.
