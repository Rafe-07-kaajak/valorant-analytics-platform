# Real Prediction Backend Integration

Version: 1.0 (TASK-047)

Status: Complete. Connects Prediction Studio to the TASK-046 offline inference service through a server-only "Historical Model Replay" mode, while preserving the existing synthetic scenario experience unchanged as the default. Real predictions are historical-replay only — no arbitrary future team-vs-team matchup is served as a real-model prediction.

---

## Purpose

TASK-046 produced a validated, self-tested, Node-only model-inference service — but nothing in the repository connected it to an actual request path. Prediction Studio still rendered only synthetic VCT profiles. TASK-047 builds the smallest safe backend integration that lets a user see a genuine trained-model prediction, sourced from TASK-044's own pre-match feature snapshots, without touching the synthetic engine, without constructing features from arbitrary input, and without ever sending a model artifact or raw feature row to the browser.

## Feasibility decision

Three real-prediction flows were evaluated (per TASK-047's own scoping):

- **A. Historical-match replay** (chosen): load an existing TASK-044 pre-match feature row by `matchInternalId`, send it to the TASK-046 service, return a real model prediction for that historical pre-match state.
- **B. Team-vs-team hypothetical prediction** (not implemented): would require constructing a *new* pre-match feature row from current temporal state (rolling Elo, recent form, head-to-head, roster continuity, schedule/rest) for an arbitrary team pair "as of now." TASK-044's feature pipeline is a batch, chronological state-replay engine (`stateEngine.ts`) over the curated dataset — it has no online/incremental feature-construction API, and building one is exactly the kind of "online feature construction" TASK-044 and TASK-046 both explicitly deferred (see docs/32, docs/34, "Known limitations"). Building it now would mean either reimplementing feature math outside its leakage-safe pipeline (a correctness and duplication risk) or a substantial new online-feature-service task — out of scope here.
- **C. Synthetic scenario mode** (preserved unchanged): Prediction Studio's existing scenario builder continues to use `@repo/prediction-engine`'s synthetic VCT profiles, now explicitly labeled "Synthetic Scenario" in the new UI section, with no change to its request/response contract, its computation, or its existing tests.

Flow B is documented here as an intentionally omitted flow, not silently unsupported — the UI never implies an arbitrary team matchup produces a real-model prediction.

## Architecture

```
apps/web (client)
  └─ Historical Model Replay UI (features/prediction-studio/historical/)
       └─ fetch (apps/web/src/lib/api/realPrediction.ts)
            ↓
apps/web (server-only)
  └─ API routes (app/api/internal/prediction/{historical,catalog,readiness}/route.ts)
       └─ server/prediction/predictionAdapter.ts   (request/response mapping)
       └─ server/prediction/historicalCatalog.ts    (safe catalog + filters)
       └─ server/prediction/historicalFeatureRepository.ts  (feature-row lookup)
       └─ server/prediction/modelService.ts          (lazy PredictionService singleton)
       └─ server/prediction/readiness.ts
       └─ server/prediction/errors.ts / config.ts
            ↓
@repo/model-inference (TASK-046, unchanged behavior)
  └─ PredictionService.predict() → loaded model artifact
```

All new server-only code lives under `apps/web/src/server/prediction/` and `apps/web/src/app/api/internal/prediction/`. Nothing under `apps/web/src/features/**` or `apps/web/src/hooks/**` (the client layer) imports `@repo/model-inference` or `@repo/vlr-ingestion` directly — verified by `grep -rl "@repo/model-inference\|@repo/vlr-ingestion" apps/web/src` (only the five `server/prediction/*.ts` files match) and by a passing production `next build` whose three new API routes compile to 149-byte server function stubs, not client bundle content.

### A pre-existing build landmine this task had to fix

`@repo/vlr-ingestion`'s main barrel (`src/index.ts`) transitively imports `vlr/fixtureLoader.ts`, which computed its fixtures directory via `fileURLToPath(new URL("../../fixtures", import.meta.url))`. That exact syntactic form (`new URL(literal, import.meta.url)`) is a bundler idiom webpack statically pattern-matches and tries to resolve as a bundled asset. `apps/web` never previously imported `@repo/vlr-ingestion` or `@repo/model-inference` (docs/34's isolation argument depended on exactly that), so this was never exercised through Next's webpack build until this task legitimately added that dependency — at which point `next build` failed with `Module not found: Can't resolve '../../fixtures'`. Fixed by rewriting `fixtureLoader.ts` to compute the same path via `resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures")` (identical runtime result, no special webpack handling triggered). Verified: `pnpm --filter @repo/vlr-ingestion test` (649/649 passing, unchanged) and `pnpm --filter web build` both pass after the fix.

Additionally, two narrow package `exports` subpaths were added (both purely additive, zero behavior change) so `apps/web`'s server-only code imports only what it needs rather than pulling in unrelated ingestion/HTTP/parsing modules:

- `@repo/vlr-ingestion/persistence/pathSafety` — reuses the existing, tested `resolveSafePath`/`safeFileName` primitives directly, rather than importing the full barrel or duplicating path-traversal-safety logic.
- `@repo/model-inference/testFixtures` — reuses the existing `buildFixtureArtifact` test helper (built in TASK-046) for this task's own unit/integration tests, rather than hand-rolling a second fixture-artifact builder.

## Prediction modes

`PredictionMode = "synthetic-scenario" | "historical-real-model"` (`packages/shared/src/types/real-prediction.ts`). The synthetic engine's own `PredictionResult` contract (`packages/shared/src/types/prediction.ts`) is **not modified** — mixing mode-provenance fields into it would touch `@repo/prediction-engine` and its ~15 existing test files for no functional benefit, since the two modes are unified only at the display layer, never by changing the synthetic engine's contract. `HistoricalPredictionResponse.mode` is always the literal `"historical-real-model"`; nothing here ever labels a synthetic response as real, or vice versa.

Fallback policy: **no automatic fallback between modes.** A requested historical prediction that cannot be served returns a structured error (see "Errors" below); it never silently substitutes a synthetic result. Synthetic mode's own behavior is completely unaffected by whether the real-model backend is available.

## UI integration

A separate, always-visible **"Historical Model Replay"** card (`features/prediction-studio/historical/HistoricalReplaySection.tsx`) is rendered below the existing Synthetic Scenario builder + result, rather than a tab that would need to replace it. Two reasons, both about minimizing blast radius:

1. The existing scenario-builder DOM/e2e/unit tests interact with region/team controls the instant the page loads — a tab-default would need to reproduce those exact semantics anyway, for no isolation benefit.
2. Each mode keeps fully independent hook/component state, so there is no shared result area where a historical prediction and a synthetic one could ever be visually confused — satisfying "switching modes does not mix stale outputs" by construction rather than by explicit reset logic.

States covered: readiness loading, readiness error (with retry), real-prediction unavailable (with retry, synthetic scenario explicitly still usable), catalog loading/error/empty/populated, match selection, prediction loading, prediction success (labeled "Real trained model", with provenance), prediction error (with retry). The result card (`HistoricalMatchResult.tsx`) is deliberately restrained (TASK-047 requirement 13): probability, predicted side, confidence, model version/estimator/calibration, warnings — never a fabricated feature-importance breakdown for the Elo model, never the actual historical outcome (no reveal control was built — see "Known limitations").

## Historical feature-row repository

`server/prediction/historicalFeatureRepository.ts` reads `<REAL_PREDICTION_FEATURE_DATA_DIR>/features/{feature-manifest.json,feature-rows.json}` — TASK-044's own export, unmodified, read-only. Loaded once per process and memoized (`resetHistoricalRepositoryCacheForTesting()` is test-only; no public route triggers a reload). On the real local dataset today: **432 rows**, `featureDatasetVersion 64591ef5a24f9a0b`.

Security property worth stating explicitly: a request's `matchInternalId` is used **only** as a lookup key against this already-loaded, in-memory `Map<string, RawHistoricalRow>` — it is never interpolated into a filesystem path, so match-ID path traversal is not a code path that exists here at all (verified by `historicalFeatureRepository.test.ts` and the route's own request-validation tests).

Label fields (`labelTeamAWin`, `labelWinnerProviderId`, `labelSeriesScore`, `labelMapCountPlayed`) remain present on the in-memory `RawHistoricalRow` (it is TASK-044's row, read as-is) but are **never** copied into a model request or a catalog entry: `predictionAdapter.ts`'s `buildFeaturesFromRow` only ever copies keys that appear in the loaded artifact's own `featureContract.requiredInputFields` list — a list that, by TASK-045's `featurePolicy.ts` design, never contains an identifier or label field. Labels cannot leak by construction, not by a manually-maintained exclusion list. Verified directly: every backend test asserts `JSON.stringify(response)` never contains a label field name.

If the dataset directory or its two files are missing/unreadable, every entry point (`getFeatureDatasetManifestSafe`, `getHistoricalRowById`, `listHistoricalRows`, the catalog builder, the adapter) reports a structured `historical_data_unavailable` — never a crash, never an unhandled rejection.

## Historical match catalog

`server/prediction/historicalCatalog.ts`. Exposes only: `matchInternalId`, `scheduledAt`, `eventFamily`, `eventRegion`, `tournamentLevel`, `seriesFormat`, `teamAProviderId`, `teamBProviderId`, `modelEligible` (always `true` — TASK-044 never exports an ineligible row), `featureDatasetVersion`. **Never** a label, score, winner, or raw feature vector. Filters (`eventFamily`, `teamProviderId`, `scheduledAfter`/`scheduledBefore`, `limit`) are validated strictly (`request_invalid` on malformed input, never silently ignored). Sorted stably ascending by `scheduledAt`, ties broken by `matchInternalId` (mirrors TASK-044's own state-engine tie-break rule). Bounded to `REAL_PREDICTION_CATALOG_LIMIT` (default 50, hard max 200) regardless of a caller-requested `limit` — the full 432-row dataset is never sent in one response.

No team display names: `teams.json` (TASK-043) carries no display-name field, and `apps/web/src/constants/vct.ts`'s 32-team roster carries no VLR provider-ID mapping to join against — the catalog and result UI show raw provider IDs (e.g. `vlr:team:1120`), documented here rather than fabricated.

## Backend contract

`packages/shared/src/types/real-prediction.ts` — `HistoricalPredictionRequest` (`{ mode, matchInternalId, requestId?, requestedModelVersion? }`) and `HistoricalPredictionResponse` (match metadata, `modelVersion`/`estimatorType`/`calibrationMethod`/`sourceFeatureDatasetVersion`/`featureSchemaVersion`, `teamAWinProbability`/`teamBWinProbability`/`predictedWinnerSide`/`confidence`, `warnings`, `predictionGeneratedAt`, `inferenceDurationMs`, `dataProvenance`, `resultAvailability`). Never includes: labels, the actual historical winner, map scores, raw features, an artifact path, or model coefficients — the response is built field-by-field in `predictionAdapter.ts` from TASK-046's own `InferenceResponse`, never a passthrough of internal state.

The browser can **never** supply a raw feature vector: the POST route's strict field allowlist (`mode`, `matchInternalId`, `requestId`, `requestedModelVersion`) rejects any other key — including a `features` object, `labelTeamAWin`, or a literal `__proto__` key parsed from the JSON body — before the request ever reaches the adapter (`request_invalid`, 400).

## Errors

`server/prediction/errors.ts` reuses TASK-046's `InferenceError` semantics by mapping every `InferenceErrorCode` onto this task's own smaller, browser-safe `PredictionErrorCode` taxonomy (`model_unavailable`, `model_loading`, `historical_data_unavailable`, `historical_match_not_found`, `feature_dataset_version_mismatch`, `feature_row_invalid`, `model_version_mismatch`, `inference_validation_failed`, `inference_failed`, `request_invalid`, `internal_error`), each with a fixed `retryable` flag and HTTP status. Field-level `InferenceError`s (`missing_feature`, `invalid_feature_type`, etc.) are deliberately mapped to `feature_row_invalid` rather than passed through verbatim — those codes can only fire here because *this service's own code* built the request from a stored row, never from browser input, so surfacing the underlying field name would leak internal schema detail for no caller benefit. `toSafeJSON()` never includes a stack trace or filesystem path.

## Model lifecycle

`server/prediction/modelService.ts` — lazy-load-on-first-request. Next.js route handlers have no single reliable app-wide startup hook across dev/build/production (and none at all for a serverless target), so the first call to `getReadyModelService()` in a process triggers `PredictionService.start()` once; every subsequent call across every route reuses the same validated, self-tested instance. A failed load is never thrown to route callers under normal operation — `readiness()`/`predict()` observe the resulting not-ready state structurally. `setModelServiceForTesting()` is the test-only injection point every backend test in this task uses to supply a fixture `PredictionService` instead of the real gitignored artifact.

## Caching

- Model registry: TASK-046's own singleton, reused as-is (one validated artifact instance per process, no per-request reload).
- Feature dataset: loaded once per process (`historicalFeatureRepository.ts`'s in-memory cache), reset only by an explicit test-only function — no public route can trigger a reload.
- Historical catalog: computed on demand from the cached dataset (a 432-row in-memory sort/filter is sub-millisecond — see "Performance" — so no additional cache layer was justified).

## Security checklist

- No raw feature vector accepted from the browser (route-level strict allowlist).
- No label field ever copied into a model request or catalog entry (feature extraction is allowlist-driven from the artifact's own contract, not an exclusion list).
- No match-ID path traversal (matchInternalId is a `Map` key, never a path segment).
- No arbitrary model-version file selection (the artifact directory is fixed by server config; `requestedModelVersion` is only ever checked against the *currently loaded* version, never used to select a file).
- No filesystem path in any response (readiness/catalog/prediction payloads all verified path-free in tests).
- No stack trace in any error response (`toSafeJSON()`).
- Oversized POST bodies rejected before JSON parsing (8 KB cap; historical prediction requests are a handful of short fields).
- A literal `__proto__` key parsed from a JSON body is rejected by the strict field allowlist (defense-in-depth; verified by a dedicated test).
- No winner/score/label ever appears in a catalog entry.
- No `@repo/model-inference`/`@repo/vlr-ingestion` import reaches a client component (verified by source grep and by the production build's route-size output).

## Performance

Measured against the real TASK-045/046 artifact (`elo-baseline`, `modelVersion aa85997f41de1264`) and the real 432-row TASK-044 feature dataset, local development hardware, 2026-07-19:

| Metric | Value |
|---|---|
| Cold model load (validate + self-test, via `PredictionService.start()`) | 17.37ms |
| Historical catalog build (sort + slice 50 of 432 rows) | 0.127ms |
| First historical prediction (cold repository + cold-ish service) | 0.790ms |
| Warm repeated historical prediction (avg of 50 reps) | 0.0447ms |

Single-process, single-machine, local development hardware only — not a production-scale or concurrent-load benchmark, consistent with TASK-046's own stated performance caveat.

## Tests

- **Backend unit/integration** (`apps/web/src/server/prediction/*.test.ts`): 53 tests — repository (valid load, missing dataset, duplicate ID, unknown match, malformed ID, caching, **and a real-local-dataset smoke test that runs against the actual TASK-044 export when present**), catalog (filters, sorting, bounding, label-absence), errors (every `InferenceError` → `PredictionErrorCode` mapping), adapter integration (deterministic fixture-artifact + fixture-dataset predictions, parity across repeated calls, model-unavailable, data-unavailable, disabled-by-config, multiple distinct rows), readiness (available/unavailable/disabled, no-path-leak).
- **Route tests** (`apps/web/src/app/api/internal/prediction/**/route.test.ts`): 18 tests — success paths, malformed JSON, wrong `mode`, unknown/extra fields, `__proto__` injection, oversized payload, not-found, requestId echoing, label-absence.
- **Frontend component tests** (`HistoricalReplaySection.test.tsx`): 6 tests — unavailable state, catalog load, empty state, successful labeled prediction, retryable error state, no-result-before-selection.
- **E2E** (`e2e/historical-replay.spec.ts`, Playwright `page.route()` fixtures — no real gitignored artifact, no external network): 5 tests — synthetic scenario builder unaffected when real prediction is unavailable, historical section becomes visible/usable when readiness reports available, a full select-a-match-and-predict flow labeled "Historical Model Replay", retry from an unavailable state, and a failed-prediction error state that never breaks the page.
- **Existing-suite regression**: full `apps/web` unit suite (524/524, including the untouched `PredictionStudioClient.test.tsx`/`ScenarioBuilder.test.tsx`), full `services/vlr-ingestion` suite (649/649), full `services/model-inference` suite (98/98), and the full existing Playwright suite (all specs green in isolation; see "Known limitations" for one pre-existing flake under full-parallel load, unrelated to this task).

**Total new tests added by this task: 82** (53 backend + 18 route + 6 frontend + 5 e2e).

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `REAL_PREDICTION_ENABLED` | `true` | Master kill switch; `false` reports `model_unavailable` regardless of underlying readiness |
| `REAL_PREDICTION_FEATURE_DATA_DIR` | `services/vlr-ingestion/.local/vlr-data`, resolved relative to this module's own location on disk | Root dir containing `features/` — never a hardcoded developer-machine path |
| `REAL_PREDICTION_CATALOG_LIMIT` | `50` | Clamped to `[1, 200]` |

`MODEL_INFERENCE_*` (TASK-046) is reused as-is for controlling the underlying artifact (directory, expected version pins, fallback policy, etc.) — no duplicate variable was introduced for that surface.

## Existing-product isolation

- `services/prediction-engine`'s tests and behavior are completely untouched (full suite still passing as part of `pnpm -r test`).
- Prediction Studio's synthetic scenario flow is unchanged (`PredictionStudioClient.test.tsx`, `ScenarioBuilder.test.tsx` pass unmodified).
- No other route (`/`, `/map-matchup`, `/team-comparison`) was touched.
- No artifact or feature dataset is bundled to the browser (verified by production build output: the three new API routes compile to 149-byte server function stubs).
- No public reload endpoint exists for either the model registry or the historical dataset cache.
- No network access is introduced (this task's code never imports anything network-capable; VLR ingestion's own network kill switch is untouched).

## Known limitations

- **Historical replay only** — an arbitrary future/hypothetical team-vs-team matchup is not served as a real-model prediction (see "Feasibility decision," flow B). Building it would require an online/incremental feature-construction service TASK-044/046 both deliberately deferred.
- **Requires local generated data** — `REAL_PREDICTION_FEATURE_DATA_DIR`'s `features/` export and the TASK-046 model artifact are both gitignored, locally-generated outputs. A fresh checkout (or CI) has neither; every code path here handles that as a graceful `*_unavailable` state, and the synthetic scenario builder remains fully functional regardless.
- **Selected model is Elo** — a two-number-per-team baseline, unchanged from TASK-045's frozen selection; this task does not retrain or reselect a model.
- **No team display names** — provider IDs only (see "Historical match catalog").
- **No actual-outcome reveal** — TASK-047 requirement 14 ("reveal the actual result after viewing the prediction") was scoped but not built: `resultAvailability.actualResultRevealable` is always `false` today. The label fields already exist on the loaded row (never sent to the browser), so a future task could add a clearly-separated, opt-in reveal endpoint without touching the prediction path at all.
- **No deployment/scheduling** — no production packaging, no background reload, no scheduled ingestion (unchanged from TASK-046).
- **One pre-existing e2e flake, unrelated to this task**: `e2e/prediction-studio.spec.ts`'s "no accessibility violations" test intermittently reports a missing `<title>` element when run under the full 84+-test Playwright suite with 6 parallel workers (a document-hydration race under heavy concurrent load), but passes reliably every time it was run in isolation or light load during this task's verification. A `test-results/` artifact for this exact failure already existed in the repository before this task began, indicating it predates TASK-047.

## Next step

TASK-048 (or later): production packaging/deployment readiness for the model-inference service, and/or a defensibly-scoped online feature-construction path if arbitrary team-vs-team real predictions become a product requirement. Neither is started by this task.
