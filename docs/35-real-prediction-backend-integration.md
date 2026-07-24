# Real Prediction Backend Integration

Version: 1.1 (TASK-047, extended by the real-model integration task)

Status: Complete. Connects Prediction Studio to the TASK-046 offline inference service through two explicit real-model modes — server-only "Historical Model Replay" (a specific past match) and "Real Model" (an arbitrary current team pairing, added by the real-model integration task) — while preserving the existing synthetic scenario experience unchanged as the default. Every mode is explicit and visible; none ever silently falls back to another.

---

## Purpose

TASK-046 produced a validated, self-tested, Node-only model-inference service — but nothing in the repository connected it to an actual request path. Prediction Studio still rendered only synthetic VCT profiles. TASK-047 builds the smallest safe backend integration that lets a user see a genuine trained-model prediction, sourced from TASK-044's own pre-match feature snapshots, without touching the synthetic engine, without constructing features from arbitrary input, and without ever sending a model artifact or raw feature row to the browser.

## Feasibility decision

Three real-prediction flows were evaluated (per TASK-047's own scoping):

- **A. Historical-match replay** (chosen): load an existing TASK-044 pre-match feature row by `matchInternalId`, send it to the TASK-046 service, return a real model prediction for that historical pre-match state.
- **B. Team-vs-team hypothetical ("current matchup") prediction** (implemented by the real-model integration task, after initially being deferred here): constructs a *new* pre-match feature row from current temporal state (rolling Elo, recent form, head-to-head, roster continuity, rest days) for an arbitrary team pair "as of" the real data cutoff. TASK-044's feature pipeline is a batch, chronological state-replay engine (`stateEngine.ts`) over the curated dataset with no online/incremental feature-construction API of its own — rather than reimplementing that math separately (a correctness/duplication risk), `services/vlr-ingestion/src/feature/currentMatchupRow.ts` reuses the exact same `TeamState`/`HeadToHeadRegistry`/`EventCongestionRegistry`/Elo machinery `runFeatureStateEngine` already uses for every real match, replaying the full real history once and then taking one further honest snapshot for the requested pair. The one input that genuinely cannot come from real data — competitive tier/event context, since no match is actually scheduled — is an explicit, visible user choice (Regional Season vs. International), never a silent assumption; see "Current matchup real-model prediction" below.
- **C. Synthetic scenario mode** (preserved unchanged): Prediction Studio's existing scenario builder continues to use `@repo/prediction-engine`'s synthetic VCT profiles, now explicitly labeled "Synthetic Scenario" in the new UI section, with no change to its request/response contract, its computation, or its existing tests.

All three flows are explicit, always-visible modes the user chooses between — the UI never implies one flow produced another flow's result.

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

### Current matchup real-model prediction (Prediction Studio's main flow)

```
apps/web (client)
  └─ ScenarioBuilder's "Real Model" mode (features/prediction-studio/{PredictionModeToggle,MatchTierToggle,RealCurrentPredictionResult}.tsx)
       └─ fetch (apps/web/src/lib/api/realPrediction.ts#predictCurrentMatch)
            ↓
apps/web (server-only)
  └─ app/api/internal/prediction/current/route.ts
       └─ server/prediction/currentPredictionAdapter.ts     (request validation, response mapping)
       └─ server/prediction/currentMatchupRepository.ts     (raw curated matches/events, real data cutoff)
       └─ server/prediction/powerRankingsRepository.ts       (reused for real per-team confidence tiering)
       └─ server/prediction/modelService.ts                  (same lazy PredictionService singleton Historical Replay uses)
            ↓
@repo/vlr-ingestion (feature/currentMatchupRow.ts)
  └─ buildCurrentMatchupRow() → replays real history via runFeatureStateEngine, then one honest "as of now" snapshot
            ↓
@repo/model-inference (TASK-046, unchanged behavior)
  └─ PredictionService.predict() → loaded model artifact
```

Team confidence (`verified`/`provisional`/`unrated`) reuses the exact same `computeDataConfidence` tiering Power Rankings already established (`apps/web/src/features/power-rankings/rankingModel.ts`), so the two features never disagree about what "verified" means for the same team. A team below the well-sampled threshold, or whose identity mapping isn't verified, surfaces as a visible warning on the prediction result — never an unexplained default.

## Prediction modes

`PredictionMode = "synthetic-scenario" | "historical-real-model" | "current-real-model"` (`packages/shared/src/types/real-prediction.ts`). The synthetic engine's own `PredictionResult` contract (`packages/shared/src/types/prediction.ts`) is **not modified** — mixing mode-provenance fields into it would touch `@repo/prediction-engine` and its ~15 existing test files for no functional benefit, since every mode is unified only at the display layer, never by changing the synthetic engine's contract. A response's `mode` field is always the literal matching how it was actually produced; nothing here ever labels one mode's response as another's.

Fallback policy: **no automatic fallback between modes.** A requested historical or current-matchup prediction that cannot be served returns a structured error (see "Errors" below); it never silently substitutes a synthetic result, and the synthetic engine never silently substitutes a real one. Synthetic mode's own behavior is completely unaffected by whether either real-model backend is available. The mode a user is in is always an explicit, visible, URL-persisted choice (`CanonicalUrlState.mode`), never inferred.

## UI integration

A separate, always-visible **"Historical Model Replay"** card (`features/prediction-studio/historical/HistoricalReplaySection.tsx`) is rendered below the existing Synthetic Scenario builder + result, rather than a tab that would need to replace it. Two reasons, both about minimizing blast radius:

1. The existing scenario-builder DOM/e2e/unit tests interact with region/team controls the instant the page loads — a tab-default would need to reproduce those exact semantics anyway, for no isolation benefit.
2. Each mode keeps fully independent hook/component state, so there is no shared result area where a historical prediction and a synthetic one could ever be visually confused — satisfying "switching modes does not mix stale outputs" by construction rather than by explicit reset logic.

States covered: readiness loading, readiness error (with retry), real-prediction unavailable (with retry, synthetic scenario explicitly still usable), catalog loading/error/empty/populated, match selection, prediction loading, prediction success (labeled "Real trained model", with provenance), prediction error (with retry). The result card (`HistoricalMatchResult.tsx`) is deliberately restrained (TASK-047 requirement 13): probability, predicted side, confidence, model version/estimator/calibration, warnings — never a fabricated feature-importance breakdown for the Elo model, never the actual historical outcome (no reveal control was built — see "Known limitations").

## Historical feature-row repository

`server/prediction/historicalFeatureRepository.ts` reads `<REAL_PREDICTION_FEATURE_DATA_DIR>/features/{feature-manifest.json,feature-rows.json}` — TASK-044's own export, unmodified, read-only. Loaded once per process and memoized (`resetHistoricalRepositoryCacheForTesting()` is test-only; no public route triggers a reload). On the real local dataset today: **432 rows**, `featureDatasetVersion 4ea57b57ed74f619` (416 eligible at-or-after the Masters-Toronto-2025 canonical window, 16 excluded from training/ranking eligibility but still present here for full historical replay coverage).

Security property worth stating explicitly: a request's `matchInternalId` is used **only** as a lookup key against this already-loaded, in-memory `Map<string, RawHistoricalRow>` — it is never interpolated into a filesystem path, so match-ID path traversal is not a code path that exists here at all (verified by `historicalFeatureRepository.test.ts` and the route's own request-validation tests).

Label fields (`labelTeamAWin`, `labelWinnerProviderId`, `labelSeriesScore`, `labelMapCountPlayed`) remain present on the in-memory `RawHistoricalRow` (it is TASK-044's row, read as-is) but are **never** copied into a model request or a catalog entry: `predictionAdapter.ts`'s `buildFeaturesFromRow` only ever copies keys that appear in the loaded artifact's own `featureContract.requiredInputFields` list — a list that, by TASK-045's `featurePolicy.ts` design, never contains an identifier or label field. Labels cannot leak by construction, not by a manually-maintained exclusion list. Verified directly: every backend test asserts `JSON.stringify(response)` never contains a label field name.

If the dataset directory or its two files are missing/unreadable, every entry point (`getFeatureDatasetManifestSafe`, `getHistoricalRowById`, `listHistoricalRows`, the catalog builder, the adapter) reports a structured `historical_data_unavailable` — never a crash, never an unhandled rejection.

## Historical match catalog

`server/prediction/historicalCatalog.ts`. Exposes only: `matchInternalId`, `scheduledAt`, `eventFamily`, `eventRegion`, `tournamentLevel`, `seriesFormat`, `teamAProviderId`, `teamBProviderId`, `modelEligible` (always `true` — TASK-044 never exports an ineligible row), `featureDatasetVersion`. **Never** a label, score, winner, or raw feature vector. Filters (`eventFamily`, `teamProviderId`, `scheduledAfter`/`scheduledBefore`, `limit`) are validated strictly (`request_invalid` on malformed input, never silently ignored). Sorted stably newest-first (descending by `scheduledAt`), ties broken ascending by `matchInternalId` (mirrors TASK-044's own state-engine tie-break rule). Bounded to `REAL_PREDICTION_CATALOG_LIMIT` (default 50, hard max 200) regardless of a caller-requested `limit` — the full 432-row dataset is never sent in one response.

No team display names: `teams.json` (TASK-043) carries no display-name field, and `apps/web/src/constants/vct.ts`'s 32-team roster carries no VLR provider-ID mapping to join against — the catalog and result UI show raw provider IDs (e.g. `vlr:team:1120`), documented here rather than fabricated.

## Backend contract

`packages/shared/src/types/real-prediction.ts` — `HistoricalPredictionRequest` (`{ mode, matchInternalId, requestId?, requestedModelVersion? }`) and `HistoricalPredictionResponse` (match metadata, `modelVersion`/`estimatorType`/`calibrationMethod`/`sourceFeatureDatasetVersion`/`featureSchemaVersion`, `teamAWinProbability`/`teamBWinProbability`/`predictedWinnerSide`/`confidence`, `warnings`, `predictionGeneratedAt`, `inferenceDurationMs`, `dataProvenance`, `resultAvailability`). Never includes: labels, the actual historical winner, map scores, raw features, an artifact path, or model coefficients — the response is built field-by-field in `predictionAdapter.ts` from TASK-046's own `InferenceResponse`, never a passthrough of internal state.

The browser can **never** supply a raw feature vector: the POST route's strict field allowlist (`mode`, `matchInternalId`, `requestId`, `requestedModelVersion`) rejects any other key — including a `features` object, `labelTeamAWin`, or a literal `__proto__` key parsed from the JSON body — before the request ever reaches the adapter (`request_invalid`, 400).

## Errors

`server/prediction/errors.ts` reuses TASK-046's `InferenceError` semantics by mapping every `InferenceErrorCode` onto this task's own smaller, browser-safe `PredictionErrorCode` taxonomy (`model_unavailable`, `model_loading`, `historical_data_unavailable`, `historical_match_not_found`, `feature_dataset_version_mismatch`, `feature_row_invalid`, `model_version_mismatch`, `inference_validation_failed`, `inference_failed`, `request_invalid`, `internal_error`, plus `current_matchup_data_unavailable` for the current-matchup flow's raw curated dataset), each with a fixed `retryable` flag and HTTP status. Field-level `InferenceError`s (`missing_feature`, `invalid_feature_type`, etc.) are deliberately mapped to `feature_row_invalid` rather than passed through verbatim — those codes can only fire here because *this service's own code* built the request from a stored row, never from browser input, so surfacing the underlying field name would leak internal schema detail for no caller benefit. `toSafeJSON()` never includes a stack trace or filesystem path.

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

**Real-model integration task (current-matchup "Real Model" mode) added, on top of the above:** `currentMatchupRow.test.ts` (7, vlr-ingestion), `currentMatchupRepository.test.ts` (4), `currentPredictionAdapter.integration.test.ts` (7), 12 new tests in `PredictionStudioClient.test.tsx`'s "Real Model mode" block, `urlState` mode-parsing/serialization coverage, and `e2e/prediction-studio-real-mode.spec.ts` (10 tests: explicit mode switching, no automatic fallback in either direction, real runtime service invocation, model version/provenance display, a provisional-team warning, an unsupported-team failure state, URL mode persistence across back/forward, mobile layout, and two accessibility/console-network checks).

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
- **Selected model is Elo** — a two-number-per-team baseline, re-selected against the corrected Masters-Toronto-2025-onward canonical training window (see the real-data-correction task); still the conservative-fallback choice, not retrained on demand per request.
- **Temporal fidelity is a truthful label, not true walk-forward model-snapshot serving** (resolved gap, real-data-correction task): a single trained model is applied uniformly to every historical match. `dataProvenance.temporalFidelity` is `"point-in-time"` only when the replayed match's `scheduledAt` falls strictly after the active model's `trainDateRangeEndIso`; otherwise (including when the cutoff is unknown) it is `"retrospective"`, with an explanatory warning appended and a distinct UI badge. This does not build genuine per-timestamp model selection — a match correctly labeled `"retrospective"` still runs against today's single active model, not a model trained only on data before that match.
- **No team display names** — provider IDs only (see "Historical match catalog").
- **No actual-outcome reveal** — TASK-047 requirement 14 ("reveal the actual result after viewing the prediction") was scoped but not built: `resultAvailability.actualResultRevealable` is always `false` today. The label fields already exist on the loaded row (never sent to the browser), so a future task could add a clearly-separated, opt-in reveal endpoint without touching the prediction path at all.
- **No deployment/scheduling** — no production packaging, no background reload, no scheduled ingestion (unchanged from TASK-046).
- **Two confirmed pre-existing/load-sensitive e2e flakes, unrelated to any specific task**: `e2e/prediction-studio.spec.ts`'s "no accessibility violations" test intermittently reports a missing `<title>` element when run under the full Playwright suite with 6 parallel workers (a document-hydration race under heavy concurrent load), but passes reliably every time it was run in isolation or light load. A second instance of the same class of flake was confirmed during the real-model integration task: `e2e/cross-feature-navigation.spec.ts`'s "the page is accessible with cross-feature links rendered" test intermittently reports a `color-contrast` violation (a CSS-application race — axe scanning before the dark theme's styles have fully painted) only under the full-suite's heaviest concurrent load; it passed 3/3 times run in isolation. Both are formally baselined here rather than chased further: retrying the same timing-dependent race under artificially light load would not prove anything about the full-suite condition that actually triggers it, and neither reproduces as a real, user-visible defect (both pages render correctly and pass every accessibility check whenever checked directly). `test-results/` artifacts for the `<title>` case already existed in the repository before TASK-047 began, confirming it predates that task.
- **Two real bugs found and fixed during the real-model integration task's e2e validation** (not flakes): a page-wide `getByRole("button", { name: /Paper Rex/ })` locator in `cross-feature-navigation.spec.ts` became genuinely ambiguous once Historical Replay's real archive could also render "Paper Rex" as visible button text — fixed by scoping both occurrences to each side's own team-selector group. A case-insensitive text collision between the new "Real Model" mode-toggle button and Historical Replay's pre-existing "Real trained model" result badge — fixed by renaming the toggle's label to "Real Model" only (not "Real Trained Model"), since Playwright/RTL text matching is case-insensitive/substring by default.

## Next step

Real-model integration for Prediction Studio's *main* flow (an explicit "Real Model" mode alongside the existing synthetic scenario builder, using real online feature construction for an arbitrary current team pairing) is now implemented — see `services/vlr-ingestion/src/feature/currentMatchupRow.ts`, `apps/web/src/server/prediction/currentPredictionAdapter.ts`, and the `/api/internal/prediction/current` route. Remaining future work: production packaging/deployment readiness for the model-inference service (TASK-048's own scope), and richer competitive-tier input for a current-matchup prediction (today only a binary Regional/International assumption, entered explicitly by the user) if finer-grained event context becomes a product requirement.
