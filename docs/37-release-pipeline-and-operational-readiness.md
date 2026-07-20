# Release Pipeline and Operational Readiness

Version: 1.0 (TASK-049)

Status: Complete. Adds a reproducible, provider-neutral release pipeline that combines the application source and TASK-048's runtime package into a validated, versioned release bundle; a promotion workflow (`candidate` → `validated` → `approved`); rollback-safe metadata; production configuration validation; a preflight validator; a deployment dry-run; an in-process operational smoke test; and CI fixture-based validation. **No deployment occurred, no artifact was uploaded, no credential was used, and no external network request was made anywhere in this task.** The release bundle remains gitignored and local. Production provider integration remains future work.

---

## Purpose

TASK-048 produced a deterministic, hash-verified, gitignored "runtime package" and taught `apps/web` to optionally read from it. Nothing turned that package plus the application source into a versioned, promotable, rollback-safe **release**, and no CI stage, environment schema, preflight validator, or operational runbook existed. TASK-049 builds the smallest safe layer on top: a release-identity/manifest contract, a bundle builder/validator, a promotion state machine, rollback metadata, a preflight validator, a deployment dry-run, an in-process smoke test, and a fixture-based CI job — without retraining the model, without changing model selection, and without deploying anything.

## Architecture

```
source commit
  -> application verification         (pnpm lint / check-types / test / build)
  -> validated runtime package         (TASK-048, unchanged, reused as-is)
  -> release manifest                  (deterministic release identity)
  -> release bundle staging            (gitignored, local)
  -> release bundle validation         (independent re-read from disk)
  -> deployment dry-run                (plan only, zero side effects)
  -> external deployment                future work, not started here
```

```
services/release-pipeline/src/
  releaseErrors.ts            19-code stable error taxonomy
  releaseRulesVersion.ts      RELEASE_RULES_VERSION, PRODUCTION_CONFIG_SCHEMA_VERSION
  sourceFingerprint.ts        deterministic recursive directory content-fingerprint
  gitInspect.ts                read-only git commit/branch/dirty state (best-effort)
  lockfileFingerprint.ts       sha256 of pnpm-lock.yaml
  releaseVersion.ts            computeReleaseVersion() — deterministic release identity
  environmentSchema.ts         typed production env-var schema + validator
  manifest.ts                  ReleaseManifest type + buildReleaseManifest()
  releaseConfig.ts             RELEASE_* env-driven CLI config
  bundleBuilder.ts             orchestrates staging into a release bundle
  bundleValidator.ts           independent from-disk re-validation
  bundleInspect.ts             safe status/inspect summaries
  security/bundleSecurityAudit.ts   path/secret/symlink/allowlist audit
  preflight.ts                  production preflight validator
  deployDryRun.ts               deployment plan generator (no side effects)
  promotion.ts                  candidate/validated/approved state machine
  rollbackManifest.ts           rollback-safety metadata builder
  smokeTestDefinition.ts        describes what release:smoke:local checks
  cli/*                         pnpm release:* command entrypoints
  testFixtures/buildFixtureReleaseInputs.ts   fixture repo+app+runtime-package composer

apps/web/
  scripts/releaseSmoke.ts                     pnpm release:smoke entrypoint (tsx)
  src/server/release/releaseSmokeChecks.ts    the actual in-process checks
```

**Why a new workspace package rather than extending `@repo/model-inference`**: this task's concern (application source + a runtime package + release metadata) spans both `apps/web` and `services/model-inference` and needs its own CLI surface; a fourth responsibility bolted onto `model-inference` would blur that package's existing "model inference service" boundary. `services/release-pipeline` mirrors `services/model-inference`'s exact shape (env-driven config re-read per call, `tsx` CLI entrypoints, colocated tests) and depends on it (`loadRuntimePackage`, `validateRuntimePackage`, `RuntimePackageManifest` are reused directly, never re-implemented) plus `@repo/vlr-ingestion` (`resolveSafePath`, `stableStringify`, `contentHashOf`).

**Why the release bundle's `app/` directory is source-pinned, not compiled**: TASK-048 already found a real, reproducible limitation — Next's `output: "standalone"` trace-copy step requires OS-level symlink privileges unavailable on this repository's non-admin Windows development host. Rather than force a compiled build into the bundle (large, environment-sensitive, and risks embedding source maps), the bundle's `app/` directory carries `package.json`, `next.config.ts`, and a deterministic content-fingerprint manifest of the source tree. A deployment consumer checks out `sourceCommitSha`, runs `pnpm install --frozen-lockfile && pnpm build`, then mounts the bundle's `runtime-package/` directory — see `operations/deployment-spec.json`. This keeps the bundle small (measured **3.2 MB** against the real local application, regardless of the ~113 MB of source/assets being fingerprinted — see "Performance" below) and avoids re-deriving TASK-048's already-documented standalone-build limitation.

## Release identity

`releaseVersion = sha256(canonicalReleaseInputs).slice(0, 16)`, mirroring `computeRuntimePackageVersion`'s exact pattern (`services/release-pipeline/src/releaseVersion.ts`).

Canonical inputs: `releaseRulesVersion`, `sourceCommitSha` (optional — "when available"), `runtimePackageVersion`, `modelVersion`, `sourceFeatureDatasetVersion`, `applicationBuildFingerprint`, `lockfileHash`, `configSchemaVersion`. Deliberately excludes `generatedAt`, hostnames, absolute paths, and any random identifier.

`applicationBuildFingerprint` is computed by `sourceFingerprint.ts`: every file under `apps/web/{src,public}` plus `next.config.ts`/`package.json` is hashed (raw bytes, sha256), sorted by relative path, and folded into one top hash. This deliberately does **not** use Next's own `BUILD_ID` (randomly generated per build unless `generateBuildId` is set) — a random component would break idempotency.

**Verified against real local data** (`services/model-inference/.local/runtime-package` version `c0bd5813eb4b8a04`, model `aa85997f41de1264`): `pnpm release:bundle:build` run twice in a row produced the identical `releaseVersion` `38f3fee482c842bb` both times; only `generatedAt` differed. Verified programmatically too (`bundleBuilder.test.ts`, fixture-based): rebuilding against unchanged fixture inputs reproduces the same `releaseVersion` and identical per-file hash arrays; changing the fixture application source, the fixture runtime package version, or the fixture lockfile content each independently changes `releaseVersion`.

## Release manifest

`release-manifest.json` (`services/release-pipeline/src/manifest.ts`) contains: `releaseRulesVersion`, `releaseVersion`, `generatedAt` (informational only), `sourceCommitSha`/`sourceBranch` (optional), `applicationBuildFingerprint`, `applicationFramework`, `nodeVersionRequirement`, `pnpmVersion`, `lockfileHash`, `runtimePackageVersion`, `modelVersion`, `estimatorType`, `calibrationMethod`, `sourceFeatureDatasetVersion`, `featureSchemaVersion`, `featureRulesVersion`, `supportedRuntimeTargets`/`conditionalRuntimeTargets`/`unsupportedRuntimeTargets`, `applicationFiles[]`/`runtimePackageFiles[]` (sorted `{fileName, sha256, sizeBytes}`), `configSchemaVersion`, `sizeSummaryBytes`, `securityAssertions`, `testVerificationSummary`/`buildVerificationSummary`, `rollbackCompatibilityMetadata`.

`securityAssertions` are computed booleans, not hardcoded claims — every byte staged into a bundle is either a content-fingerprint of source (never raw source bytes), a verbatim copy of an already-validated, already label-stripped runtime package, or generated JSON/text with no external input, so the assertions hold by construction; `bundleValidator.ts` independently re-verifies this from disk rather than trusting the builder's in-memory claim.

`testVerificationSummary`/`buildVerificationSummary` default to `{ performed: false }` — never a fabricated pass. `pnpm release:bundle:build` only reports a real pass/fail when a prior `pnpm release:preflight` run's report is threaded in (the runbook's documented order: preflight, then bundle build).

**Note on `sizeSummaryBytes.applicationTotalBytes`**: this measures the size of the *fingerprinted source tree* (everything read to compute `applicationBuildFingerprint`), not bytes physically copied into the bundle — the bundle's `app/` directory only ever contains three small generated/copied files. Measured against the real `apps/web` tree: `applicationTotalBytes` is **113,256,598 bytes** (dominated by `apps/web/public`'s ~108 MB of VCT logo/image assets), while the bundle's actual on-disk footprint is **3.2 MB**.

## Environment schema

`environmentSchema.ts` documents every variable already read by `apps/web/src/server/prediction/config.ts` and `services/model-inference/src/config.ts` (`REAL_PREDICTION_*`, `MODEL_INFERENCE_*`) plus application-level variables (`NODE_ENV`, `PORT`, `HOSTNAME`, `NEXT_PUBLIC_SITE_URL`). No new variable's *behavior* is introduced — this module documents and validates, it never re-implements the config modules that already read these values.

`validateEnvironment(env, { strictProduction })`: with `strictProduction: false` (the default), every variable is optional with a safe default. With `strictProduction: true`: `REAL_PREDICTION_SOURCE_MODE` must be `"runtime-package"` (rejects `local-generated` in a production release), `REAL_PREDICTION_REQUIRE_RUNTIME_PACKAGE` and `MODEL_INFERENCE_REQUIRE_MODEL_ON_START` must be `"true"` (fail-fast, not silent degrade), and `NODE_ENV` must be `"production"`.

`buildEnvironmentSchemaDocument()`/`buildExampleEnvContent()` produce `config/environment-schema.json` and `config/environment-example.txt` inside a release bundle — placeholders only, verified by test that no line outside a `#` comment contains an `=`.

## Preflight (`pnpm release:preflight`)

Four sections: **source** (commit SHA availability — informational, since `sourceCommitSha` is documented as "when available" throughout; clean-tree check, gated by `RELEASE_REQUIRE_CLEAN_TREE`; lockfile presence), **application** (spawns `pnpm lint` / `check-types` / `test` / `build` — the exact same suites that already contain the TASK-048 Edge-runtime-marker and client-bundle-isolation audits, so preflight never reimplements those), **runtimePackage** (`loadRuntimePackage` against the configured directory), **configuration** (`validateEnvironment` against the live `process.env`).

The application section's process-spawning is injectable (`CommandRunner`) so unit tests stay fast (`preflight.test.ts` stubs it); the real CLI uses a real `child_process.spawn`.

**Verified against the real repository**: full preflight (real lint/check-types/test/build across all 9 workspace packages, real runtime package, real environment) passed in **49,187 ms** for the build step alone (~51s wall time total), 2026-07-20. All four sections passed.

## Bundle build / validate / promote / rollback

`pnpm release:bundle:build` consumes an already-validated runtime package (never rebuilds one — that stays `pnpm runtime:package:build`'s job) and stages `release-manifest.json`, `app/{package.json,next.config.ts,source-manifest.json}`, a verbatim copy of `runtime-package/{manifest.json,model/*,historical/*}`, `config/{environment-schema.json,environment-example.txt}`, and `operations/{preflight-report.json,smoke-test-definition.json,rollback-manifest.json}` into a fresh temp directory, then atomically renames it into place (mirrors `runtimePackage/build.ts`'s own atomic-write pattern). `--fixture` builds entirely against a fixture runtime package + fixture app source tree (`buildFixtureReleaseInputs`, composing `@repo/model-inference`'s own real `buildFixtureRuntimePackage` — never a parallel implementation).

`pnpm release:bundle:validate` independently re-reads the bundle from disk: recomputes `releaseVersion`, re-validates the copied runtime package via the real `loadRuntimePackage` (not a reimplementation), cross-checks `app/source-manifest.json` against `release-manifest.json`, and runs the security audit. `--deep` additionally re-fingerprints the live application source and compares it to the bundle's recorded fingerprint (catches drift between build and validate). `--fixture` builds and validates a fresh fixture bundle in one self-contained step.

`pnpm release:promote -- --to <validated|approved>` implements only `candidate → validated → approved`; `deployed`/`rolled-back` are explicitly rejected (`release_invalid_transition`, exit code 7) since no provider integration exists. Promotion metadata is written to `services/release-pipeline/.local/release-state/<releaseVersion>/promotion-manifest.json` — deliberately outside the bundle directory, so approving a release never mutates its own content-hashed files (verified: `release-manifest.json`'s bytes are identical before/after promotion in both the automated test and the real-data run below). `approved` requires either `--dry-run` or a sanitized operator name (never an email address).

`pnpm release:rollback:manifest` (also generated automatically inside every bundle) reports `rollbackCompatible`, `rollbackBlockers`, and explicitly distinguishes **application rollback**, **runtime package rollback**, and **real-mode disablement** — the last of which requires no code or data change at all, since synthetic scenario mode has zero dependency on the model or runtime package.

## Deployment dry-run (`pnpm release:deploy:dry-run`)

Reads an already-built bundle and produces a JSON plan: startup step sequence (checkout → install → build → mount → configure → start), readiness/health URLs, rollback target, environment compatibility, post-deployment verification steps, and rollback steps (reused directly from the rollback manifest's own checklist). Every report ends with the four required disclaimer strings. Performs zero network requests and spawns zero processes beyond reading local files — verified directly by test (`deployDryRun.test.ts`) and by the real run below.

## Operational smoke (`pnpm release:smoke:local`)

`apps/web/scripts/releaseSmoke.ts` (via `apps/web/src/server/release/releaseSmokeChecks.ts`) imports `readiness.ts`, `historicalCatalog.ts`, and `predictionAdapter.ts` directly — no HTTP server is started, no network request is made. Six checks: readiness contract shape, synthetic-mode availability (structural, since synthetic mode has no server dependency), historical catalog non-empty when available, a deterministic repeated prediction (same `matchInternalId` twice → identical `teamAWinProbability`/`predictedWinnerSide`/`modelVersion`), optional expected-version pins, and a safe-unavailable-state check (no path/stack-trace leakage).

**Verified against real local data**: `pnpm release:smoke:local` reported all 6 checks passing, with a deterministic repeated prediction for `vlr:match:448598` at `modelVersion aa85997f41de1264`.

## CI

`.github/workflows/ci.yml` gains one new job, `release-pipeline` (`needs: verify`), running three fixture-only steps: build, validate, and deploy-dry-run, all with `--fixture`. No real `.local/` data is required (CI never has any); no artifact upload; no external network beyond the normal `pnpm install --frozen-lockfile`; no secrets. Unit/integration tests for `@repo/release-pipeline` need no separate CI job — `pnpm test` (`turbo run test`) already picks up every workspace package, so the existing `verify` job covers them for free.

## Security

Every release bundle is independently audited by `security/bundleSecurityAudit.ts`: symlink rejection (`lstat`, never followed), a fixed filename allowlist (unexpected files rejected outright), forbidden filenames/extensions (`.env`, `id_rsa`, `.pem`/`.key`/`.p12`/`.pfx`/`.crt`), secret-shaped pattern heuristics (AWS-key-shaped, PEM private-key headers, common API-token shapes), an embedded-absolute-path heuristic, and the same `__proto__`/`constructor`/`prototype` prototype-pollution key scan `runtimePackage/loader.ts` already uses. Verified by 10 dedicated unit tests (`security/bundleSecurityAudit.test.ts`) planting each violation individually, plus integration tests in `bundleValidator.test.ts` proving a real built bundle has **zero** findings and that specific tampering (a hand-edited manifest, a planted `.env`, a planted secret pattern) is caught.

Runtime: `JSON.parse` only, never `eval`/`Function`/dynamic `import()`; the runtime package inside a bundle is only ever read via `@repo/model-inference`'s real `loadRuntimePackage`, never a bespoke parser.

**Client-bundle isolation is now an automated check, not just documentation prose.** `docs/35`/`docs/36` both describe this invariant as verified by a one-off manual `grep` run during TASK-047/048 — neither task committed an actual test. This task adds `apps/web/src/server/clientBundleIsolation.test.ts`, which walks `apps/web/src/features/**` and `apps/web/src/hooks/**` and asserts no file's source text references `@repo/model-inference`, `@repo/vlr-ingestion`, `server/prediction`, `server/release`, `runtimePackageSource`, `node:fs`, or `node:child_process`. It runs as part of `pnpm test` (and therefore `pnpm release:preflight`'s application section) going forward — confirmed passing against the real, unmodified `features/**`/`hooks/**` trees.

CI: no secrets referenced anywhere in the new workflow job; no deployment token; no artifact publishing.

## Error taxonomy

19 stable codes in `releaseErrors.ts` (`release_source_dirty`, `release_commit_unavailable`, `release_runtime_package_missing`, `release_runtime_package_invalid`, `release_application_build_missing`, `release_application_build_invalid`, `release_manifest_invalid`, `release_hash_mismatch`, `release_version_mismatch`, `release_config_invalid`, `release_forbidden_file`, `release_unsafe_path`, `release_symlink_rejected`, `release_secret_detected`, `release_target_unsupported`, `release_preflight_failed`, `release_smoke_failed`, `release_invalid_transition`, `release_bundle_missing`), each with a fixed `retryable` flag and CLI exit code, mirroring `services/model-inference/src/errors.ts`'s exact shape (`toSafeJSON()` never includes a stack trace or the original `cause`).

## Performance

Measured on local development hardware, 2026-07-20, against the real TASK-045/048 model artifact and runtime package (`elo-baseline`, `modelVersion aa85997f41de1264`, `runtimePackageVersion c0bd5813eb4b8a04`, 432 historical rows):

| Metric | Value |
|---|---|
| `release:bundle:build` (real data, cold) | ~3.1 s |
| `release:bundle:build` (real data, rebuild) | idempotent — identical `releaseVersion 38f3fee482c842bb` |
| `release:bundle:validate` (real data) | ~2.3 s, 0 security findings |
| `release:deploy:dry-run` (real data) | < 2 s, 0 network calls |
| `release:preflight` (real data, full lint/check-types/test/build) | 49,187 ms (build step) / ~51 s (total) |
| `release:smoke:local` (real data) | all 6 checks pass |
| Release bundle size (on disk) | 3.2 MB |
| `applicationTotalBytes` (fingerprinted source, not bundle size) | 113,256,598 bytes |
| `runtimePackageTotalBytes` | 3,121,653 bytes (unchanged from TASK-048) |
| `configTotalBytes` | 8,163 bytes |
| `applicationFiles` / `runtimePackageFiles` count | 292 / 8 |
| Fixture `release:bundle:build --fixture` | ~4.0 s |
| Fixture `release:deploy:dry-run --fixture` | ~1.9 s |

Single-process, single-machine, local development hardware only — consistent with TASK-046/047/048's own stated performance caveats.

## Tests

- **Unit/integration** (`services/release-pipeline/src/**/*.test.ts`): 93 tests across 15 files — release identity determinism/change-sensitivity, manifest purity, environment schema validation (including strict-production rules), source fingerprinting (determinism, change detection, symlink rejection, exclusion of `node_modules`/`.next`/`.git`), Git-state best-effort degradation, lockfile hashing, bundle build (idempotency, change-sensitivity to app/runtime-package/lockfile, never-mutates-source, missing-package rejection, rollback threading), bundle validation (hash-mismatch/missing-file/forbidden-file/secret/deep-drift rejection), the security audit (10 targeted violation-planting tests), preflight (stubbed command runner, section-level pass/fail), deploy dry-run (disclaimers, target support levels, environment compatibility), promotion (every valid/invalid transition, operator sanitization, immutability, history append-only), rollback manifest (compatible/incompatible, blockers, fallback policy text).
- **`apps/web` additions**: `src/server/release/releaseSmokeChecks.test.ts` — 4 tests (full-availability pass, safe unavailable state with no path leakage, expected-version-mismatch failure, determinism across two independent runs); `src/server/clientBundleIsolation.test.ts` — 2 tests (newly-committed automated version of the previously-manual TASK-047/048 isolation check, extended to also cover this task's own `server/release/**` module).
- **Existing-suite regression**: full `apps/web` suite green, **545/545** tests (62 files, includes the 4 new smoke-check tests + 2 new isolation tests); full existing Playwright suite green, **86/86**, including the unmodified `e2e/historical-replay.spec.ts` and `e2e/runtime-package-provenance.spec.ts` — no new Playwright specs were added (no new browser-facing UI exists for this task; the in-process `release:smoke:local` stands in for post-deployment verification).
- **Total new automated tests added by this task: 99** (93 + 4 + 2).

## Verification performed

- `pnpm --filter @repo/release-pipeline run check-types` / `run lint` / `run test` — clean, 93/93.
- `pnpm --filter web run check-types` / `run lint` / `run test` — clean, 543/543.
- `pnpm lint` / `pnpm check-types` / `pnpm test` / `pnpm build` (full monorepo, via `pnpm release:preflight`) — all pass, 2026-07-20.
- `pnpm test:e2e -- --workers=1` — 86/86 passing.
- `pnpm runtime:package:status` / `pnpm release:audit` / `pnpm release:preflight` / `pnpm release:bundle:build` / `pnpm release:bundle:validate` / `pnpm release:bundle:status` / `pnpm release:bundle:inspect` / `pnpm release:deploy:dry-run` / `pnpm release:promote -- --to validated` / `pnpm release:promote -- --to approved --dry-run` / `pnpm release:rollback:manifest` — all run successfully against the real local TASK-044/045/048 output; real numbers captured above.
- Rebuilt the real bundle twice consecutively — `releaseVersion` identical (`38f3fee482c842bb`), `generatedAt` differed.
- Confirmed promoting to `deployed`/`rolled-back` is rejected (`release_invalid_transition`, exit code 7) against the real bundle.
- Confirmed `release-manifest.json`'s bytes are unchanged after promoting to `approved`.
- Confirmed via file content comparison that `services/model-inference/.local/runtime-package/manifest.json` and the fixture app source tree were unmodified across builds (also covered by an automated test).
- Confirmed `services/release-pipeline/.local/` is fully covered by a new `.gitignore` entry.

## Known limitations

- **No actual deployment** — this task stages and validates a release bundle locally; nothing was deployed, published, or uploaded anywhere.
- **No external artifact storage / no provider credentials** — CI's fixture job intentionally omits an artifact-upload step.
- **No production monitoring backend** — `release:smoke:local` and the readiness endpoint are manual/on-demand tools, not an alerting pipeline.
- **`app/` is source-pinned, not compiled** — a deployment consumer must run its own `pnpm install && pnpm build` from the pinned commit; the bundle does not itself contain a runnable compiled artifact (see "Architecture" above for why).
- **Serverless remains conditional** — unchanged from TASK-048; this task adds no serverless-specific code path.
- **Edge remains unsupported** — enforced by the existing TASK-048 route markers; this task's own static config (`operations/deployment-spec.json`) documents, not enforces, that.
- **Historical replay only** — an arbitrary future/hypothetical matchup is still not served as a real-model prediction (unchanged from TASK-047).
- **Selected model is still Elo, no calibration** — this task neither retrains nor reselects a model.
- **No live feature construction, no scheduler, no online retraining** — unchanged from TASK-046/047/048.
- **Promotion has no `deployed`/`rolled-back` state** — by design; those require a provider-specific integration that does not exist yet.

## Next step

A provider-specific deployment task (container registry push, a specific cloud provider's deploy API, or a documented manual-operator runbook execution) would be the concrete next step if deployment becomes a near-term goal — this task deliberately stops at a validated, dry-run-verified release bundle, per its own scope.
