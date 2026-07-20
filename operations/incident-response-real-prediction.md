# Incident Response — Real (Historical-Replay) Prediction

Version: 1.0 (TASK-049)

Scope: incidents affecting `REAL_PREDICTION_*` historical-replay mode only. Synthetic scenario mode is architecturally independent of everything in this document and should never be affected by a real-mode incident.

---

## Immediate mitigation (always available, no code/data change)

Set `REAL_PREDICTION_ENABLED=false` and restart, or otherwise ensure `REAL_PREDICTION_REQUIRE_RUNTIME_PACKAGE=false` with no package mounted. The readiness endpoint will report `realPredictionAvailable: false` with a safe, non-retryable message; the UI's own readiness-aware behavior (TASK-047) hides historical-replay mode and falls back to synthetic scenario mode automatically. **This requires no deployment, no rollback, and no data change.**

## Diagnosis

1. Check the readiness endpoint: `GET /api/internal/prediction/readiness`. Note `modelStatus`, `historicalDataAvailable`, `sourceMode`, `message`, `retryable`.
2. Cross-reference the reported `currentModelVersion`/`runtimePackageVersion` (when `sourceMode: "runtime-package"`) against the release manifest you believe is deployed (`pnpm release:bundle:status` or the bundle's own `release-manifest.json`).
3. Run `pnpm release:smoke:local` against the affected environment for a fuller in-process diagnostic (readiness contract, catalog, one deterministic prediction, expected-version checks).

## Common failure modes and response

| Symptom | Likely cause | Response |
|---|---|---|
| `historicalDataAvailable: false` | Runtime package missing/not mounted, or `local-generated` data absent | Verify the mount path matches `REAL_PREDICTION_RUNTIME_PACKAGE_DIR`; re-mount if needed |
| `modelStatus: "unloaded"` with `sourceMode: "runtime-package"` | Package failed a structural check (hash mismatch, version mismatch, corrupted file) | Do not attempt to "fix" the mounted files by hand — re-mount a known-good, independently-validated package (`pnpm release:bundle:validate`) |
| Readiness available but predictions return `runtime_package_version_mismatch` / `feature_dataset_version_mismatch` | `REAL_PREDICTION_EXPECTED_RUNTIME_PACKAGE_VERSION` (or the model's own recorded dataset version) disagrees with what's mounted | Confirm which version is actually expected by the currently-deployed application release; re-mount or re-pin accordingly |
| Predictions succeed but look wrong | Out of scope for this runbook — a model-quality concern, not an operational incident. Escalate to model owners; do not roll back infrastructure for this alone |

## Escalation path

1. Apply immediate mitigation (real-mode disablement) first, always.
2. Diagnose using the readiness endpoint and `release:smoke:local`.
3. If a rollback is warranted, follow `operations/rollback-runbook.md`.
4. Document the incident: what was observed, what mitigation was applied, what the root cause was, and whether a documentation/tooling gap contributed (feed back into `docs/37`'s "Known limitations" if relevant).

## What this stack does *not* have (do not assume otherwise)

- No database, so there is no data-corruption rollback beyond re-mounting a runtime package directory.
- No live/online feature construction — historical replay is the only real-model mode; there is no "regenerate a live feature row" mitigation.
- No scheduler or online retraining — the model version does not change on its own.
- No production monitoring backend is wired up by this task — readiness/smoke tooling is manual/on-demand, not alerting.
