# VLR Model Inference Service

Version: 1.0 (TASK-046)

Status: Complete. Loads the TASK-045 selected model artifact, validates it, and serves deterministic offline predictions through a stable, provider-neutral service contract. No frontend integration. Prediction Studio still serves synthetic VCT profiles, unchanged.

---

## Purpose

TASK-045 produced a frozen, versioned model artifact and an offline reference predictor (`inference.ts`) — but nothing in the repository could load that artifact safely, validate untrusted input against it, or expose it through a contract another service could depend on. TASK-046 builds that production-ready foundation: artifact loading, artifact/request validation, an in-process model registry with atomic hot-reload, structured errors, health/readiness, observability, and a CLI — all without touching the frontend, without retraining, and without changing TASK-044's feature semantics.

## Architecture

**Package**: `services/model-inference/` (`@repo/model-inference`) — a new sibling service package, not an extension of `services/prediction-engine`.

**Why a new package, not an extension of `services/prediction-engine`**: `@repo/prediction-engine`'s single `"."` export is imported directly by client components in `apps/web` (e.g. `apps/web/src/features/prediction-studio/ScenarioBuilder.tsx`), so anything added to that package's export surface is a candidate for the client bundle. The inference service needs Node-only APIs (`node:fs/promises`, `node:crypto`) that must never reach a browser bundle. A new, separate workspace package that nothing in `apps/web` depends on gives that isolation by construction — `apps/web/package.json` has no dependency on `@repo/model-inference`, so there is no accidental import path into the client bundle. This mirrors the repository's existing pattern of one service package per bounded context (`vlr-ingestion`, `prediction-engine`) rather than introducing a new architectural pattern.

**Reuse, not reimplementation**: `services/vlr-ingestion/src/modeling/{artifact,inference,modelVersion}.ts` already implement every estimator's math (Elo passthrough, logistic regression, gradient-boosted trees, sigmoid/isotonic calibration) and the artifact's content-hash scheme. `services/vlr-ingestion/src/index.ts` now re-exports these (plus `resolveSafePath`/`safeFileName` from the persistence layer) alongside its existing ingestion/identity/quality/modeling exports — the same additive, in-pattern barrel-export style already used for every other module in that file. `@repo/model-inference` depends on `@repo/vlr-ingestion` (a package `apps/web` never depends on, so this adds no transitive path to the client) and calls that code directly. **No model math, hashing, or path-safety logic is duplicated anywhere in this task.**

**Module layout** (`services/model-inference/src/`):

| Module | Responsibility |
|---|---|
| `config.ts` | Typed, `process.env`-driven configuration; secure defaults |
| `errors.ts` | Stable error taxonomy, safe serialization, HTTP status mapping |
| `artifactSource.ts` | Local-filesystem artifact source: allowlisted filenames, symlink rejection, size limits |
| `artifactValidator.ts` | Content-hash verification, cross-file version agreement, estimator/calibration support |
| `inferenceAdapter.ts` | Thin translation layer into `@repo/vlr-ingestion`'s `predict()` — the only place model math is invoked |
| `selfTest.ts` | Deterministic startup self-test over a contract-derived synthetic row |
| `requestSchema.ts` | `InferenceRequest` validation against the loaded feature contract |
| `responseSchema.ts` | `InferenceResponse` construction |
| `registry.ts` | In-process model registry: state machine, atomic load/reload |
| `metrics.ts` | Bounded rolling counters/timings |
| `health.ts` | Liveness/readiness/internal-status builders |
| `predictionService.ts` | Service facade — the single entry point every caller (CLI, and later TASK-047) should use |
| `audit.ts` | Read-only artifact readiness audit |
| `cli/*.ts` | `pnpm inference:model:*` commands, each calling the facade only |
| `testFixtures/buildFixtureArtifact.ts` | Reuses `@repo/vlr-ingestion`'s own `writeModelArtifact` to build elo/logistic/tree fixture artifacts for tests |

## Artifact contract

Consumed as written by TASK-045 (`services/vlr-ingestion/src/modeling/artifact.ts`'s `ModelArtifactFiles`), unchanged. Five files are inference-critical and are the only files this service ever reads: `model.json`, `preprocessing.json`, `calibration.json`, `feature-contract.json`, `model-manifest.json`. The remaining six (`model-card.json`, `evaluation.json`, `test-predictions.json`, `fold-predictions.json`, `reliability-data.json`, `feature-importance.json`) are reporting/diagnostic output this service never reads at load or inference time.

## Configuration

All read fresh from `process.env` on every call (never cached at module scope, mirroring `services/vlr-ingestion/src/env.ts`). Every numeric value is clamped to a safe range.

| Variable | Default | Notes |
|---|---|---|
| `MODEL_INFERENCE_ARTIFACT_DIR` | `services/vlr-ingestion/.local/vlr-data/models/selected-model`, resolved relative to this package's own location on disk | Never a hardcoded developer-machine path |
| `MODEL_INFERENCE_EXPECTED_MODEL_VERSION` | unset (any) | Load-time pin; mismatch → `requested_model_version_mismatch` |
| `MODEL_INFERENCE_EXPECTED_FEATURE_SCHEMA_VERSION` | unset (any) | Load-time pin; mismatch → `feature_schema_mismatch` |
| `MODEL_INFERENCE_LOAD_ON_START` | `true` | |
| `MODEL_INFERENCE_REQUIRE_MODEL_ON_START` | `false` | If `true`, `start()` throws when the load did not end ready/degraded |
| `MODEL_INFERENCE_STRICT_HASH_VALIDATION` | `true` | |
| `MODEL_INFERENCE_PROBABILITY_CLIP_EPSILON` | `1e-15` | Clamped to `[0, 1e-6]` |
| `MODEL_INFERENCE_MAX_REQUEST_BYTES` | `262144` | Clamped to `[1024, 1048576]` |
| `MODEL_INFERENCE_RELOAD_ENABLED` | `false` | No background timer/file-watch is implemented in this task (see "Known limitations") |
| `MODEL_INFERENCE_RELOAD_INTERVAL_MS` | unset | Only read when reload is enabled |
| `MODEL_INFERENCE_FALLBACK_POLICY` | `disabled` | `disabled` \| `constant` |
| `MODEL_INFERENCE_FALLBACK_CONSTANT_PROBABILITY` | `0.5` | Clamped to `[0, 1]`; only used when fallback policy is `constant` |
| `MODEL_INFERENCE_TIMEOUT_MS` | `5000` | Clamped to `[100, 30000]` |
| `MODEL_INFERENCE_LOG_MODE` | `safe` | `safe` \| `debug` |
| `MODEL_INFERENCE_MAX_ARTIFACT_FILE_BYTES` | `10000000` | Clamped to `[10000, 50000000]` |

No variable enables network access — this package never imports anything network-capable. Invalid values fall back to the documented default rather than throwing (mirrors the `vlr-ingestion` config pattern); config parsing is covered by `config.test.ts`.

## Model registry

States: `unloaded → loading → ready`, or `→ failed` (no fallback configured) / `→ degraded` (constant fallback configured) on a failed initial load. A **failed reload never replaces a previously healthy model** — the candidate is fully validated and self-tested in isolation before the registry's live reference is reassigned; on failure the old model, its `modelVersion`, and its `ready` status are all left untouched, and only `lastLoadError`/reload-failure metrics change. The reassignment itself is a single synchronous property write, so a `predict()` call already in flight always sees either the old or the new fully-validated artifact, never a partial one.

Public snapshot fields: `status`, `ready`, `modelVersion`, `estimatorType`, `calibrationMethod`, `sourceFeatureDatasetVersion`, `featureSchemaVersion`/`featureRulesVersion`, `loadedAt`, `artifactDirectoryId` (a 16-hex-char SHA-256 prefix of the resolved path — never the raw path), `lastLoadError`, `lastSuccessfulLoadAt`, `lastSelfTest`, `fallbackActive`.

## Startup load

`PredictionService.start()`: validates config → locates the artifact via `LocalFilesystemArtifactSource` → `artifactValidator.validateArtifact` (hash + cross-file version agreement + estimator/calibration support) → `selfTest.runSelfTest` → registry goes `ready` only after every self-test check passes. If `MODEL_INFERENCE_REQUIRE_MODEL_ON_START=true` and the load did not end ready/degraded, `start()` throws `model_unavailable` — this never crashes on import (nothing runs at module load time; `start()` is an explicit call the CLI or a future host makes).

The self-test row is built entirely from the loaded `feature-contract.json` (`buildSelfTestRow`) — every numeric field `0`, every boolean `false`, every categorical field its first training vocabulary entry — so it has **zero runtime dependency on the real TASK-044 feature dataset** being present.

## Request contract

```ts
interface InferenceRequest {
  requestId?: string;
  matchInternalId?: string;
  featureSchemaVersion: string;
  featureRulesVersion: string;
  sourceFeatureDatasetVersion?: string;
  requestedModelVersion?: string;
  features: Record<string, string | number | boolean | null>;
}
```

Validation is deterministic and fail-fast, always in this order: shape → `featureSchemaVersion`/`featureRulesVersion` match → missing required fields → unknown fields (strict allowlist against `requiredInputFields` — this is also how label/identifier injection is rejected, since every label/identifier is a catalog "excluded" field and therefore never in `requiredInputFields`) → per-field type → finiteness/nullability → categorical vocabulary (an unknown category is **accepted with a warning**, matching the artifact's own `=__unknown__` preprocessing bucket, never rejected outright) → (service-level) `requestedModelVersion` pin against the currently loaded version.

## Response contract

```ts
interface InferenceResponse {
  requestId?: string;
  modelVersion: string;
  sourceFeatureDatasetVersion: string;
  featureSchemaVersion: string;
  estimatorType: string;
  calibrationMethod: string;
  teamAWinProbability: number;
  teamBWinProbability: number; // always 1 - teamAWinProbability
  predictedWinnerSide: "teamA" | "teamB"; // teamA when probability >= manifest.reportingThreshold
  confidence: number; // |p - 0.5| * 2, in [0, 1] — a property of the model's own output, never a real-world accuracy claim
  predictionGeneratedAt: string;
  inferenceDurationMs: number;
  warnings: string[];
  modelMetadata: { modelVersion, estimatorType, calibrationMethod, sourceFeatureDatasetVersion, featureSchemaVersion };
}
```

Never includes: internal filesystem paths, raw coefficients, the full artifact, labels, or ground truth.

## Errors

Stable codes, each with a fixed `retryable` flag and HTTP-compatible status (for TASK-047+):

| Code | Retryable | Status |
|---|---|---|
| `model_not_loaded`, `model_loading`, `model_unavailable` | yes | 503 |
| `artifact_missing` | no | 503 |
| `artifact_hash_mismatch`, `artifact_schema_invalid` | no | 500 |
| `unsupported_estimator`, `unsupported_calibration` | no | 500 |
| `feature_schema_mismatch`, `missing_feature`, `unknown_feature`, `invalid_feature_type`, `invalid_feature_value`, `non_finite_feature` | no | 400 |
| `requested_model_version_mismatch` | no | 409 |
| `inference_failed`, `self_test_failed` | no | 500 |
| `inference_timeout` | yes | 504 |
| `unsafe_artifact_path` | no | 400 |
| `payload_too_large` | no | 413 |

`InferenceError.toSafeJSON()` never includes a stack trace or the original `cause`; `toSafeError()` maps any non-`InferenceError` thrown value to a generic `inference_failed` message rather than leaking its text.

## Estimator support

`elo-baseline`, `class-prior-baseline`, `constant-baseline`, `logistic-regression`, `gradient-boosted-trees` — every type TASK-045 can serialize. An unrecognized type fails safely with `unsupported_estimator` at validation time, before any inference is attempted. The service is **artifact-driven**: nothing in the codebase branches on "the current model is Elo" — swapping in a logistic or tree artifact requires no code change, only a new `pnpm ingest:vlr:model:train` run and a reload.

### Elo-selected artifact behavior

The current selected artifact (`modelVersion aa85997f41de1264`) is `elo-baseline`. Per `inference.ts` (reused unchanged), this estimator reads the pre-match `teamAEloWinProbability` field directly from the request's `features` — the Elo rating itself is never recomputed at inference time; it is exactly the value TASK-044 computed leakage-safely from match history up to (never including) the match being predicted. Cold-start teams (no rating history) get the manifest's neutral prior (0.5, per TASK-044). Output is clamped to `[0, 1]` via `Math.min(1, Math.max(0, p))`. Team A/B orientation and rating-direction/equal-rating behavior are covered by `services/vlr-ingestion/src/modeling/inference.test.ts` (reused, unmodified) and this task's own `selfTest.test.ts`/`predictionService.test.ts`.

## Batch inference

`predictionService.predictBatch()` — bounded to `MAX_BATCH_SIZE = 100` (a constant, not env-configurable), preserves input order, and uses a **per-item error policy**: one bad row fails only that row's `BatchItemResult`, never the whole batch. No public route exposes it; it is an internal method only.

## Health / readiness

- **Liveness** (`liveness()`): always `{ alive: true, timestamp }` — the process is responsive.
- **Public readiness** (`readiness()`): `{ ready, status, modelVersion, estimatorType, timestamp }` — safe for any future external caller.
- **Internal status** (`internalStatus()`): the full registry snapshot + metrics snapshot. Still never leaks a raw path — `artifactDirectoryId` is a hash.

## Reload

`predictionService.reload()` → `registry.reload()`: builds and self-tests a full candidate before ever touching the live registry field. Success swaps atomically and bumps `reloadCount`; failure leaves the old model untouched and bumps `reloadFailureCount` while recording `lastLoadError`. No file-watch or timed auto-reload is implemented in this task (see "Known limitations") — only the explicit `reload()` method / `pnpm inference:model:reload` CLI command.

## Fallback

Disabled by default. When `MODEL_INFERENCE_FALLBACK_POLICY=constant` and no artifact has ever loaded successfully, the registry reports `degraded` rather than `failed`, and `predict()` returns a response whose `estimatorType` is literally `"fallback-constant"` with a `warnings` entry stating `"FALLBACK MODE ACTIVE: ..."` — it is never silently blended with, or mistaken for, a real model prediction.

## Observability

`InferenceMetrics`: `inferenceCount`/`inferenceFailureCount` (by stable error code only — no high-cardinality labels), `reloadCount`/`reloadFailureCount`, `lastInferenceAt`, and a bounded 200-entry rolling window for average/p50/p95 inference duration. No feature values, request payloads, or provider/player IDs are ever logged by this package (it has no logging beyond the CLI's own `console.log`/`console.error`, which never print request bodies).

## Security

- **Artifact source**: fixed filename allowlist checked before any filesystem call; every path resolved through `resolveSafePath` (reused from `vlr-ingestion/src/persistence/pathSafety.ts`); symlinks rejected via `lstat` immediately before every read (TOCTOU-safe, not cached); per-file size limit enforced before content is read into memory.
- **Parsing**: every artifact file and every request body is parsed with `JSON.parse` only — never `eval`, `new Function`, or a dynamic `import()`/`require()` of artifact content. Non-JSON content fails closed with `artifact_schema_invalid`.
- **Prototype pollution**: `__proto__`/`constructor`/`prototype` keys in a request's `features` are rejected outright (`unknown_feature`) as a defense-in-depth boundary.
- **Content-hash tampering**: `artifact_hash_mismatch` when strict validation (default on) detects any critical file's SHA-256 doesn't match `model-manifest.json`.
- **Feature/label/identifier injection**: rejected by the strict `requiredInputFields` allowlist (see "Request contract").
- **Model version spoofing**: a request's `requestedModelVersion` is checked against the *currently loaded* artifact's real `modelVersion`, never trusted from the request alone.
- **No pickle/unsafe deserialization**: the entire artifact format is plain JSON (inherited from TASK-045); nothing in this service can execute artifact content.

## Performance

Measured against the real TASK-045 artifact (`elo-baseline`, `modelVersion aa85997f41de1264`) on local development hardware via `pnpm inference:model:benchmark`, 2026-07-19:

| Metric | Value |
|---|---|
| Artifact load (validate + self-test) | 12.4ms |
| Self-test duration | 0ms (sub-millisecond) |
| Single inference — average | 0.00087ms |
| Single inference — p50 (200 samples) | 0.0005ms |
| Single inference — p95 (200 samples) | 0.0028ms |
| Batch of 50 — total | 4.92ms (0.098ms/item average) |

These numbers reflect an Elo-baseline artifact, which is a single dictionary read — a logistic/tree artifact would be slower (a ~190-dimension dot product / tree traversal per row) but still sub-millisecond at this feature count. **Single-process, single-machine, local development hardware only** — not a production-scale or concurrent-load benchmark; no claim is made about behavior under concurrent request load.

## CLI

All network-free; all go through the service facade (never bypass it):

| Command | Purpose |
|---|---|
| `pnpm inference:model:audit` | Read-only artifact readiness audit; writes `services/model-inference/.local/model-inference-audit.json` |
| `pnpm inference:model:load` | Loads + self-tests the configured artifact |
| `pnpm inference:model:status` | Prints internal status (registry + metrics) |
| `pnpm inference:model:self-test` | Runs the self-test in isolation |
| `pnpm inference:model:predict -- <file>` | Predicts from a full `InferenceRequest` JSON or a bare flat feature row (auto-filling schema/rules versions from the loaded artifact) |
| `pnpm inference:model:batch -- <file>` | Same, over a JSON array |
| `pnpm inference:model:reload` | Triggers a manual reload; reports before/after snapshots |
| `pnpm inference:model:benchmark` | Runs and persists the local benchmark above |

## Artifact packaging policy

The artifact directory is gitignored (`services/vlr-ingestion/.local/`, and this package's own `services/model-inference/.local/` report output). Every code path here handles **exists / absent / malformed / unexpected-version** without special-casing — `artifactSource.listFiles()` returns `[]` for a missing directory rather than throwing, and every load path routes through the same `InferenceError` taxonomy either way (proven by `predictionService.integration.test.ts`'s "missing artifact directory" case). No generated artifact was copied into a tracked source directory by this task. Future packaging options (documented, not implemented): bundling a specific artifact version into a deployable image; an object-storage (S3-style) `ArtifactSource` implementation; a model-registry-backed source with version pinning. The `ArtifactSource` interface is already shaped so any of these only needs to implement `listFiles`/`statFile`/`readFile` — nothing above that layer would change.

## Production isolation

- `apps/web/package.json` has no dependency on `@repo/model-inference` (verified directly).
- No file under `apps/web/` was modified by this task (`git diff --stat` shows zero changes there).
- `apps/web`'s production build (`pnpm build`) reported a `web:build` **cache hit** after this task's changes — turbo's content-hash-based cache key proves nothing in `apps/web`'s dependency graph (including `@repo/prediction-engine`) changed, so the client bundle is provably byte-identical to before this task.
- Prediction Studio still renders `VCT_TEAM_PROFILES`/synthetic data via `@repo/prediction-engine`, unchanged.
- No product route, API route, or UI component was added, removed, or modified.
- This service never makes a network request (verified by both a source-text scan test and this task's manual CLI runs, which never touched a socket).

## Known limitations

- **Local filesystem artifact source only** — object storage / model registry sources are designed for (`ArtifactSource` interface) but not implemented.
- **No public API / HTTP adapter** — the repository has no existing internal-HTTP-server pattern for a standalone Node service to plug into, and adding one (a new dependency: Express/Fastify/similar) was not justified for this task's scope (frontend/backend wiring is TASK-047). The service facade (`PredictionService`) is ready to be wrapped by whatever transport TASK-047 chooses.
- **No frontend integration** — by design; Prediction Studio is untouched.
- **No automatic model deployment or packaging** — documented above, not implemented.
- **No background reload scheduler / file-watcher** — only explicit `reload()`. A timed or watched reload was not added because there is currently exactly one artifact-producing process (`pnpm ingest:vlr:model:train`, run manually) and no deployment target where a background timer would have an observable effect yet; `MODEL_INFERENCE_RELOAD_INTERVAL_MS` is parsed and validated so a future timer-based caller has a ready config surface, but no timer runs in this task.
- **No distributed registry** — the registry is a single in-process instance; nothing here coordinates multiple processes or replicas.
- **Current selected model is Elo** — a two-number-per-team baseline, not a learned model (see `docs/33-vlr-model-training-and-backtesting.md`, "Model selection"). The service is fully artifact-driven and requires no code change to serve a logistic-regression or gradient-boosted-tree artifact once one is selected.
- **No online feature construction** — this service consumes pre-match feature rows exactly as TASK-044 produces them; it does not compute Elo ratings, rolling win rates, or any other feature from raw match history.
- **Synchronous timeout guard is post-hoc, not preemptive** — inference is synchronous in-process arithmetic (no I/O), so `inference_timeout` reports a budget breach after the fact rather than cancelling a hung call; there is nothing to preempt in a single-threaded synchronous computation of this kind, and no artifact type currently loaded is anywhere near the configured budget (sub-millisecond vs. a 5-second default).

## Next step

TASK-047: wire this service's facade into an actual request path (frontend and/or a real HTTP/API boundary) and replace Prediction Studio's synthetic profiles with real predictions where the product decides that should happen. This task deliberately stops short of that: no route was added, no dependency from `apps/web` was introduced, and no synthetic output was replaced.
