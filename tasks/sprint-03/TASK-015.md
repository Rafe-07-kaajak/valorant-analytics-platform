# TASK-015

## Title

Feature Registry & Metadata

---

## Sprint

Sprint 03

---

## Objective

Introduce a minimal Feature Registry that documents every Team DNA feature (identifier, description, category, formula, version, status, consumers), matching the Feature Platform's required metadata.

---

## Rationale

`docs/07-feature-platform.md` states every production feature must have a unique identifier, owner, documentation, validation rules, version, category, dependencies, and consumers, and that "a feature missing any required metadata cannot enter production." `docs/00a-ubiquitous-language.md` defines "Feature Platform" as an official concept distinct from "Feature Store" (a disallowed synonym) responsible for Registry, Versioning, Validation, Metadata, Monitoring, and Serving.

TASK-014 makes the six DNA dimensions real, formula-backed features for the first time. Without a registry, those formulas exist only as implementation details scattered across `teamDna.ts`, which conflicts with the Feature Platform's core purpose: making features "reusable, versioned, discoverable" organizational assets rather than isolated calculations.

---

## Implementation Requirements

- Add a Feature Registry module (e.g. `services/prediction-engine/src/lib/featureRegistry.ts`) with a metadata entry for each of the six DNA dimension features, containing: feature ID, name, description, category (per `docs/07-feature-platform.md` categories — e.g. "Team DNA"), owner, a human-readable formula description matching the calculation implemented in TASK-014, version (starting at `v1`), status (`Production`), and consumers (`Prediction Engine`).
- Expose a `getFeatureRegistry()` (or equivalent) read accessor from the `services/prediction-engine` package entry point.
- This task is metadata only — it must not change any computed DNA value or prediction output.

---

## Acceptance Criteria

- [ ] Every DNA dimension feature implemented in TASK-014 has a complete registry entry (all required metadata fields populated).
- [ ] The registry is exported and accessible from `@repo/prediction-engine`.
- [ ] A unit test asserts the registry contains an entry for each of the six DNA dimensions and that every entry has non-empty required fields.
- [ ] No existing prediction output changes as a result of this task.
- [ ] `pnpm check-types`, `pnpm lint`, and `pnpm test` pass.

---

## Dependencies

TASK-014

---

## Status

TODO

---

## Notes

Keep this a real but minimal registry — a typed in-memory catalog, not a database-backed service. `docs/07-feature-platform.md` describes the target end-state (feature lifecycle, monitoring, drift detection); building that full platform is explicitly out of scope for Version 1 and is not required by any current sprint.
