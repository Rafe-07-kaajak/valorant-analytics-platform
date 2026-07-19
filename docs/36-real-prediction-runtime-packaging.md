# Real Prediction Runtime Packaging

Version: 1.0 (TASK-048)

Status: Complete. Defines and implements a reproducible way to package the TASK-045 selected model artifact and a label-stripped TASK-044 historical replay export into a gitignored, hash-verified "runtime package," teaches `apps/web` to optionally source real-prediction data from that package instead of the raw generated directories, and documents/validates deployment-target feasibility. **No deployment occurred.** The generated package remains gitignored and local. Historical replay still requires either the packaged or the local-generated server-side data — synthetic scenario mode remains fully independent either way.

---

## Purpose

TASK-046/047 built a working real-prediction stack that reads two gitignored, developer-machine-generated directories directly: `services/vlr-ingestion/.local/vlr-data/models/selected-model` (the model artifact) and `services/vlr-ingestion/.local/vlr-data/features` (the full feature-row export, including labels). Nothing packaged those outputs for a deployment target, nothing validated that a packaged copy was internally consistent, and nothing prevented a deployment from accidentally needing the full raw feature dataset (labels included) to be present server-side. TASK-048 builds the smallest safe packaging layer on top: a deterministic, versioned, hash-verified "runtime package" containing only what a server process actually needs, plus an explicit source-mode switch in `apps/web` so a deployment can point at either the raw local directories (today's default) or a packaged, mountable directory — without retraining, without changing model selection, and without building live/online feature construction.

## Deployment feasibility audit

Evaluated against the current architecture (filesystem-backed model + historical data, Node-only `@repo/model-inference`, Next.js API routes under `apps/web/src/app/api/internal/prediction/**`):

| Target | Verdict | Notes |
|---|---|---|
| **Local Node server** (`pnpm dev` / `node server.js`) | Supported | Today's default; unaffected by this task. |
| **Next.js production server** (`next start`) | Supported | Verified: `pnpm --filter web build` + the full existing/new test suites pass; the runtime package (when configured) is read at request time via the same filesystem APIs. |
| **Next standalone output** (`output: "standalone"`) | Supported, **not enabled by default** | See "Next.js integration" below — a real, reproducible Windows-host limitation was found and is documented rather than worked around silently. |
| **Docker / container (Linux)** | Supported | See "Container guidance." The runtime package is designed to be mounted read-only, not baked into the image. |
| **Generic Linux VM** | Supported | Same filesystem-read model as a bare Node server; no VM-specific code exists or is needed. |
| **Serverless function runtime** (e.g. Lambda-style) | **Conditional** | See "Serverless guidance" — package size and cold-start behavior are documented and measured, but no serverless-specific code path is implemented or claimed to work. |
| **Edge runtime** | **Unsupported, explicitly rejected** | See "Edge rejection." Every prediction route now declares `export const runtime = "nodejs"`. |

Default policy (per TASK-048 scope): support Node server / standalone / container paths, explicitly reject Edge, treat serverless as conditional. No target is claimed "universally compatible."

## Packaging architecture

```
services/model-inference/src/runtimePackage/
  runtimePackageTypes.ts    manifest/row/index TypeScript contracts
  runtimePackageVersion.ts  deterministic, generatedAt-independent version hash
  config.ts                 packaging CLI's own env-driven config (RUNTIME_PACKAGE_*)
  modelExport.ts            reads + validates the source model artifact (reuses validateArtifact)
  historicalExport.ts       reads TASK-044's feature-rows.json, strips labels, projects safe fields
  build.ts                  orchestrates the two exports, writes the staged package, never touches source
  loader.ts                 the ONE place any consumer reads an already-built package (all safety checks)
  validate.ts               thin pass/fail wrapper around loader.ts
  audit.ts                  read-only SOURCE readiness check (before any build)
services/model-inference/src/cli/runtimePackage*.ts   pnpm runtime:package:* commands
services/model-inference/src/testFixtures/buildFixtureRuntimePackage.ts   shared test fixture

apps/web/src/server/prediction/
  config.ts                 +sourceMode/runtimePackageDir/requireRuntimePackage/expectedRuntimePackageVersion
  runtimePackageSource.ts   memoized wrapper around loadRuntimePackage(), maps errors to PredictionApiError
  historicalFeatureRepository.ts   loadDataset() branches on sourceMode; DatasetCache shape unchanged
  modelService.ts           getInstance() branches on sourceMode; points LocalFilesystemArtifactSource at <package>/model
  readiness.ts              surfaces sourceMode/runtimePackageVersion
```

**Why extend `@repo/model-inference` rather than a new package**: it already depends on `@repo/vlr-ingestion` (for `resolveSafePath`, `stableStringify`, `contentHashOf`) and already owns the artifact filename/type contracts the packaging step reads. A fourth workspace package for one task's packaging concern was not justified.

**Why no new `ArtifactSource` implementation**: `PredictionService`'s constructor already accepts an optional second `ArtifactSource` argument (`services/model-inference/src/predictionService.ts:44-51`), falling back to `new LocalFilesystemArtifactSource(config.artifactDir)` only when omitted. Since `runtime-package/model/` contains exactly the same 5 flat allowlisted filenames `LocalFilesystemArtifactSource` already expects, `apps/web`'s `modelService.ts` simply constructs one pointed at `<package>/model` after the package's own manifest has been validated. Zero new abstraction was added to `@repo/model-inference` for this.

## Runtime package contract

```
runtime-package/
  manifest.json
  model/{model.json, preprocessing.json, calibration.json, feature-contract.json, model-manifest.json}
  historical/{historical-index.json, historical-rows.json, historical-manifest.json}
```

`manifest.json`: `packageRulesVersion`, `runtimePackageVersion` (deterministic, see below), `generatedAt` (informational, excluded from the version hash), `modelVersion`, `estimatorType`, `calibrationMethod`, `sourceFeatureDatasetVersion`, `featureSchemaVersion`, `featureRulesVersion`, `model.files[]`/`historical.files[]` (each `{fileName, sha256, sizeBytes}`, sorted by `fileName`), `historical.rowCount`/`catalogCount`, `minimumRuntimeNodeVersion`, `runtimeTargets.{supported,conditional,unsupported}`, `sizeSummaryBytes`. No secrets, no absolute paths, no raw HTML — verified by dedicated tests.

`historical-index.json`: array of safe catalog entries (`matchInternalId`, `scheduledAt`, `eventFamily`, `eventRegion`, `tournamentLevel`, `seriesFormat`, `teamAProviderId`, `teamBProviderId`, `modelEligible`, `featureDatasetVersion`) — no labels, no feature values.

`historical-rows.json`: array retaining **only** safe metadata (`matchInternalId`, `scheduledAt`, `eventInternalId`, `eventFamily`, `eventRegion`, `eventStage`, `tournamentLevel`, `seriesFormat`, `teamAProviderId`, `teamBProviderId`, `sourceDatasetVersion`, `featureSchemaVersion`, `featureRulesVersion`) plus **exactly** the currently-selected model's `requiredInputFields` (161 fields on the real dataset, read from the source artifact's `feature-contract.json` — never hand-maintained). **Never**: `labelTeamAWin`, `labelWinnerProviderId`, `labelSeriesScore`, `labelMapCountPlayed`, split/fold assignment, or any field outside that allowlist. Every row is validated at build time: no missing required field, no `NaN`/`Infinity`, no duplicate `matchInternalId`, stable chronological order (tie-break `matchInternalId`, matching `historicalCatalog.ts`'s existing comparator).

`historical-manifest.json`: `{sourceFeatureDatasetVersion, featureSchemaVersion, featureRulesVersion, rowCount, catalogCount, requiredInputFieldCount}`.

**Cross-source integrity check**: at build time, the model's own declared `sourceFeatureDatasetVersion` (from `model-manifest.json`) must equal the source feature dataset's own `featureDatasetVersion` (from `feature-manifest.json`) — if they disagree, the build fails loudly rather than silently packaging a model alongside a replay dataset it was not actually trained on.

## Versioning

`runtimePackageVersion` mirrors `services/vlr-ingestion/src/modeling/modelVersion.ts`'s `computeModelVersion` exactly:

```
canonical = JSON.stringify({
  packageRulesVersion, modelVersion, sourceFeatureDatasetVersion, featureSchemaVersion, featureRulesVersion,
  modelFileHashes: sortByFileName(model.files).map(f => [f.fileName, f.sha256]),
  historicalFileHashes: sortByFileName(historical.files).map(f => [f.fileName, f.sha256]),
  historicalRowCount, historicalCatalogCount,
})
runtimePackageVersion = sha256(canonical).slice(0, 16)
```

`generatedAt` and `sizeBytes` are excluded from the hash input. **Verified against the real local data**: running `pnpm runtime:package:build` twice in a row against unchanged source data produced the identical version `c0bd5813eb4b8a04` both times, with `generatedAt` differing between the two runs (`2026-07-19T16:23:03.026Z` → `2026-07-19T16:23:31.906Z`).

## Source modes (`apps/web`)

| Env var | Default | Semantics |
|---|---|---|
| `REAL_PREDICTION_SOURCE_MODE` | `local-generated` | `local-generated` \| `runtime-package`. An invalid value falls back to `local-generated` — there is no silent runtime auto-switch once a mode is selected. |
| `REAL_PREDICTION_RUNTIME_PACKAGE_DIR` | `services/model-inference/.local/runtime-package`, resolved relative to `config.ts`'s own location | Only consulted in `runtime-package` mode. |
| `REAL_PREDICTION_REQUIRE_RUNTIME_PACKAGE` | `false` | `true` → a missing/invalid package fails loud at first use rather than reporting a normal `runtime_package_missing` unavailable state. |
| `REAL_PREDICTION_EXPECTED_RUNTIME_PACKAGE_VERSION` | unset | Optional pin; a mismatch reports `runtime_package_version_mismatch`. |

Packaging CLI's own env (read only by `services/model-inference`'s `runtime:package:*` commands, never by `apps/web`): `RUNTIME_PACKAGE_OUTPUT_DIR`, `RUNTIME_PACKAGE_SOURCE_MODEL_DIR`, `RUNTIME_PACKAGE_SOURCE_FEATURE_DATA_DIR`, `RUNTIME_PACKAGE_MAX_FILE_BYTES`.

**How the branch stays contained**: `historicalFeatureRepository.ts`'s `loadDataset()` and `modelService.ts`'s instance-builder are the *only* two places that branch on `sourceMode`. Both produce the exact same internal shapes (`DatasetCache`, a `PredictionService`) that `historicalCatalog.ts`/`predictionAdapter.ts`/`readiness.ts` already consumed — those three files needed **zero changes** for the new source mode. Verified directly by a parity integration test (`predictionAdapter.runtimePackageParity.test.ts`): the same fixture model artifact + fixture feature dataset, served once via `local-generated` and once via a built `runtime-package`, produce byte-identical `teamAWinProbability`/`predictedWinnerSide`/`modelVersion` for the same row.

## New `PredictionErrorCode` entries

| Code | Retryable | Status | Meaning |
|---|---|---|---|
| `runtime_package_missing` | yes | 503 | Package directory/`manifest.json` absent. |
| `runtime_package_manifest_invalid` | no | 500 | Manifest unparsable, malformed, or a declared file is missing/unexpected. |
| `runtime_package_hash_mismatch` | no | 500 | A file's computed hash disagrees with the manifest's recorded hash. |
| `runtime_package_version_mismatch` | no | 409 | Actual version disagrees with a configured expected-version pin. |
| `runtime_package_model_mismatch` | no | 409 | The model artifact's own `modelVersion` disagrees with the package manifest. |
| `runtime_package_feature_mismatch` | no | 409 | Feature schema/rules version disagreement between model and historical data. |
| `runtime_package_row_count_mismatch` | no | 500 | Declared vs. actual row/catalog count disagreement, or a duplicate ID. |
| `runtime_package_unsafe_path` | no | 400 | Path traversal, symlink, or oversized file detected while reading the package. |
| `runtime_package_unsupported_target` | no | 500 | Reserved for a detected-Edge-at-runtime guard (see "Edge rejection"). |

## Next.js integration

- The three prediction API routes (`historical`, `catalog`, `readiness`) each now declare `export const runtime = "nodejs";` — an explicit marker (Next already defaults API routes to Node, but this makes Edge-incompatibility impossible to accidentally regress) verified by a static audit test (`apps/web/src/app/api/internal/prediction/nodeRuntime.test.ts`) that imports each route module and asserts the marker.
- **`output: "standalone"` is documented as the recommended container setting but is NOT enabled in the committed `next.config.ts`.** Attempting it surfaced a real, reproducible finding: Next's standalone trace-copy step recreates pnpm's symlinked `node_modules` layout, which requires OS-level symlink privileges (`SeCreateSymbolicLinkPrivilege`). On this repository's Windows development machine, without Administrator/Developer-Mode privileges, `pnpm --filter web build` failed outright with `EPERM: operation not permitted, symlink ... node_modules\react ...`. Enabling it in the shared config would have broken local development builds. A Docker build (which always runs inside a Linux container filesystem regardless of host OS) does not hit this restriction — see `docs/runtime-package-container.Dockerfile.example`, which sets `output: "standalone"` at the container build stage rather than in the tracked config.
- No `outputFileTracingIncludes` was added. The runtime package is deliberately **not** bundled into `.next/standalone` — it stays an external, mounted, read-only sibling directory, so (a) the build never requires the package to exist, and (b) refreshing the package never requires an app rebuild/redeploy.
- `pnpm --filter web build` succeeds with **zero** runtime package or real local `.local/` data present (verified — see "Verification" below); the three prediction routes still compile to 149-byte server function stubs, unchanged from TASK-047's own measurement, proving no client-bundle leakage was introduced.

## CI behavior

- Every new packaging/source-mode test uses a fixture runtime package (`buildFixtureRuntimePackage`, composing the existing `buildFixtureArtifact` + a small hand-built feature export, built through the *real* `buildRuntimePackage` function — never a parallel/duplicated implementation).
- `pnpm build`/`pnpm test` do not depend on `RUNTIME_PACKAGE_OUTPUT_DIR` or any real generated data existing.
- `pnpm runtime:package:build` (the only command that reads real local data) is a separate, manually-invoked command — never part of `pnpm build`, `pnpm test`, or `.github/workflows/ci.yml`. CI is unmodified by this task.

## Container guidance

See `docs/runtime-package-container.Dockerfile.example` (illustrative only — not referenced by any script, `package.json`, or CI workflow). Recommended layout: app code baked into the image; the runtime package mounted **read-only** at a documented path (e.g. `/app/runtime-package`) and refreshed independently of an image rebuild; `REAL_PREDICTION_SOURCE_MODE=runtime-package` + `REAL_PREDICTION_REQUIRE_RUNTIME_PACKAGE=true` set at deploy time (fail-fast if the mount is missing, rather than silently degrading); a non-root runtime user, since the package is never written to at runtime.

## Serverless guidance (conditional, not implemented)

- **Package size**: the real local package is ~3.0 MB total (`model` 52 KB + `historical` 2.99 MB + `manifest.json` 2.3 KB) — well under typical serverless deployment-package limits, so size alone is not a blocker.
- **Cold start**: `buildRuntimePackage` took 144.81 ms and `loadRuntimePackage` took ~52 ms (cold) against the real 432-row dataset on local development hardware (see "Performance") — plausible for a cold-start budget, but not measured under an actual serverless runtime.
- **Ephemeral/read-only filesystem**: most serverless runtimes provide a read-only deployment bundle plus an ephemeral `/tmp`; a package bundled directly into the deployment artifact (not mounted) could work in principle, but this was not implemented or tested against any specific provider.
- **Reload limitations**: this task's memoized, load-once-per-process caches (`getRuntimePackage()`, `historicalFeatureRepository.ts`'s dataset cache) assume a long-lived process; a serverless runtime that recycles processes per-invocation would re-pay the load cost every cold invocation, with no code path here optimized for that.
- **Verdict**: marked **conditional** in the manifest's `runtimeTargets.conditional` and in the feasibility audit above — plausible, not proven, and no serverless-specific code was added.

## Edge rejection

Every route under `api/internal/prediction/**` now declares `export const runtime = "nodejs"`, verified by a static audit test. `@repo/model-inference` and this task's `runtimePackage/*` modules use `node:fs/promises`, `node:crypto`, and `node:path` throughout — none of which exist on the Edge runtime — so an accidental Edge deployment of these routes would fail immediately rather than behave unpredictably. `runtime_package_unsupported_target` is reserved in the error taxonomy for a future explicit runtime-detection guard if one becomes necessary; no such guard was needed to satisfy this task, since the Next.js route-level marker already prevents the scenario at the framework level.

## Readiness

`readiness.ts`'s `getRealPredictionReadiness()` now also returns `sourceMode` and (only in `runtime-package` mode, best-effort) `runtimePackageVersion`. Its existing "never throws" contract is preserved: in `runtime-package` mode, if the package fails to load, `modelService.ts`'s `getReadyModelService()` catches that internally and returns a placeholder `PredictionService` reporting a normal `"unloaded"` registry status — the specific `runtime_package_*` diagnosis is still available via `historicalDataAvailable` (which becomes `false`) and, for an actual prediction *request* (not just a readiness check), via `predictionAdapter.ts`'s `getHistoricalRowById()` call, which reaches the same underlying `getRuntimePackage()` load and surfaces its specific error code directly to the POST `/historical` caller.

## Security

- **Path safety**: every package file read goes through `resolveSafePath` (reused from `@repo/vlr-ingestion`); a fixed filename allowlist is checked before any read; symlinks are rejected via `lstat` (never followed); an unexpected extra file inside `model/` or `historical/` fails the load outright (fail-loud allowlist philosophy, not silently ignored).
- **Hashing**: every file's content hash is verified against `manifest.json` before use; the manifest's own `runtimePackageVersion` is independently recomputed from the verified per-file hashes and compared against its declared value (catches a hand-edited manifest even if individual files still hash-match).
- **Parsing**: `JSON.parse` only — never `eval`, `Function`, or a dynamic `import()`/`require()` of package content.
- **Prototype pollution**: every parsed file is recursively scanned for a literal `__proto__`/`constructor`/`prototype` own-key and rejected if found.
- **Size limits**: every file is checked against a configurable byte ceiling before being read into memory.
- **Label/outcome leakage**: `historical-rows.json` never contains a label field — verified by tests scanning every row's keys, not by a manually-maintained exclusion list (the export only ever *adds* safe-metadata + `requiredInputFields`, so a label field can only appear if it were added to that allowlist, which it never is).
- **Client-bundle isolation**: no file under `services/model-inference/src/runtimePackage/**` or the new `apps/web/src/server/prediction/runtimePackageSource.ts` is imported from `apps/web/src/features/**` or `apps/web/src/hooks/**` — verified by the same grep-based check TASK-047 established, extended to cover these new files.
- **No absolute paths / no secrets / no raw HTML** in any package file — verified by dedicated tests.

## CLI reference

| Command | Purpose |
|---|---|
| `pnpm runtime:package:audit` | Read-only: are the source model artifact and source feature dataset present, valid, and version-agreeing? Never writes. |
| `pnpm runtime:package:build` | Builds the package into the staging directory. The only command that reads real local data; never run by `pnpm build`/`pnpm test`/CI. |
| `pnpm runtime:package:validate` | Validates an already-built package (hash/version agreement, row counts) without touching source data. |
| `pnpm runtime:package:status` | Human-readable summary of the currently-built package, or "not built." |
| `pnpm runtime:package:clean [-- --dry-run]` | Deletes the staging directory's contents; `--dry-run` lists without deleting. |
| `pnpm runtime:package:smoke` | Loads the built package the same way `apps/web` would, runs one real prediction against a packaged row twice (determinism check), reports pass/fail. |

## Performance

Measured against the real TASK-045/046 artifact (`elo-baseline`, `modelVersion aa85997f41de1264`) and the real 432-row TASK-044 feature dataset, local development hardware, 2026-07-19:

| Metric | Value |
|---|---|
| `runtime:package:audit` | source model + source feature dataset both valid, versions agree |
| `buildRuntimePackage` (cold) | 144.81 ms |
| `loadRuntimePackage` (cold, first read) | 52.16 ms |
| `loadRuntimePackage` (repeat read, no in-package caching) | 48.93 ms |
| Package size — model | 52,106 bytes |
| Package size — historical | 3,067,255 bytes |
| Package size — manifest | 2,292 bytes |
| Package size — total | 3,121,653 bytes (~3.0 MB) |
| Historical rows / catalog entries | 432 / 432 |
| Smoke prediction (via `pnpm runtime:package:smoke`) | `teamAWinProbability = 0.5` for the first packaged row, deterministic across two calls |
| Rebuild idempotency | `runtimePackageVersion` identical (`c0bd5813eb4b8a04`) across two consecutive builds; `generatedAt` differed |

Single-process, single-machine, local development hardware only — consistent with TASK-046/047's own stated performance caveats. `apps/web`'s own `runtimePackageSource.ts` memoizes the loaded package for the lifetime of the process (mirroring `historicalFeatureRepository.ts`'s existing cache), so `loadRuntimePackage` itself only runs once per process in the real request path — the "repeat read" number above measures the loader's own re-validation cost, not the memoized `apps/web` path.

## Tests

- **Unit** (`services/model-inference/src/runtimePackage/*.test.ts`): 32 tests — version determinism/order-independence, historical export stripping/validation/ordering/determinism, build-never-touches-source + idempotency + cross-version-mismatch rejection, loader security (path traversal, symlink rejection, hash mismatch ×2, malformed manifest, missing/extra files, prototype pollution, oversized file, version/model mismatch, duplicate IDs).
- **Unit/integration** (`apps/web/src/server/prediction/*.test.ts`): 15 new tests — `runtimePackageSource` (load, memoization, missing-package error code, version-pin mismatch, retry-after-failure), `modelService` (both source-mode branches, never-throws placeholder behavior), `historicalFeatureRepository` (+2, runtime-package mode load + missing-package handling), a full local-generated-vs-runtime-package **parity** test (identical prediction for the same row through both source modes), a static Node-runtime-marker audit (3 route checks).
- **E2E** (`e2e/runtime-package-provenance.spec.ts`, Playwright fixtures — no real data, no network): 2 tests — historical mode works normally when readiness reports `sourceMode: "runtime-package"`; a missing runtime package still leaves the synthetic scenario builder fully usable.
- **Total new tests added by this task: 49** (32 + 15 + 2).
- **Existing-suite regression**: full `services/model-inference` suite 130/130 (98 pre-existing + 32 new), full `apps/web` suite green (524 pre-existing + 15 new = 539), full existing Playwright suite green including the unmodified `e2e/historical-replay.spec.ts` (5/5).

## Verification performed

- `pnpm --filter @repo/model-inference run check-types` / `run lint` / `run test` — clean, 130/130.
- `pnpm --filter web run check-types` / `run lint` / `run test` — clean, 539/539.
- `pnpm --filter web run build` — succeeds with zero runtime package present; route sizes unchanged (149-byte stubs).
- `pnpm exec playwright test e2e/runtime-package-provenance.spec.ts e2e/historical-replay.spec.ts --workers=1` — 7/7 passing.
- `pnpm runtime:package:audit` / `build` / `validate` / `status` / `smoke` — all run successfully against the real local TASK-044/045 output; real numbers captured above.
- Rebuilt twice consecutively — `runtimePackageVersion` identical, `generatedAt` differed (idempotency proven against real data, not just fixtures).
- Confirmed via file mtimes that `services/vlr-ingestion/.local/vlr-data/features/feature-rows.json` and `.../models/selected-model/model.json` were unmodified across multiple builds.
- Confirmed `services/model-inference/.local/` (which now also contains `runtime-package/`) is fully covered by the pre-existing `.gitignore` entry — no `.gitignore` change was needed.

## Known limitations

- **No actual deployment** — this task packages and validates locally; nothing was deployed, published, or uploaded anywhere.
- **`output: "standalone"` not enabled by default** — a real Windows-symlink-privilege limitation was found and documented rather than silently worked around; a container build sidesteps it (see "Next.js integration").
- **Serverless remains conditional** — plausible on size/latency grounds, not implemented or proven against any specific provider.
- **Edge remains unsupported** — enforced by explicit route markers, not by a runtime-detection guard (the reserved `runtime_package_unsupported_target` code is not currently thrown by any code path).
- **Historical replay only** — an arbitrary future/hypothetical team-vs-team matchup is still not served as a real-model prediction (unchanged from TASK-047).
- **Selected model is still Elo** — this task neither retrains nor reselects a model.
- **No live feature construction, no scheduler, no online retraining** — unchanged from TASK-046/047.
- **Runtime package requires a manual `pnpm runtime:package:build` run** — no automatic rebuild-on-source-change, no file-watcher.

## Next step

TASK-049 (or later): if arbitrary team-vs-team real predictions become a product requirement, a defensibly-scoped online feature-construction service would be needed (deferred by TASK-044/046/047 and still deferred here). If deployment actually becomes a near-term goal, an explicit runtime-target decision (container vs. serverless) and a real `output: "standalone"` build (on a Linux CI/build host, or with Windows Developer Mode enabled) would be the next concrete step — neither is started by this task.
