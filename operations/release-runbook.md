# Release Runbook

Version: 1.0 (TASK-049)

Operator-facing steps for producing, validating, and reviewing a release of the Valorant Analytics Platform. **No step in this document deploys anything, uploads anything, or requires a credential.** Provider-specific deployment remains future work — see `docs/37-release-pipeline-and-operational-readiness.md`, "Known limitations".

---

## 0. Prerequisites

- A local checkout with a built TASK-045 model artifact and TASK-044 feature dataset (`pnpm ingest:vlr:model:train` / `pnpm ingest:vlr:features:build` already run), **or** you are only building a fixture release for CI/testing purposes.
- `pnpm install` has been run.

## 1. Build (or confirm) the runtime package

```
pnpm runtime:package:audit     # read-only: is the source model/feature data ready?
pnpm runtime:package:build     # only if the audit above passed and the package is stale/missing
pnpm runtime:package:status    # confirm the version you expect to release
```

## 2. Run preflight

```
pnpm release:preflight
```

This runs `pnpm lint`, `pnpm check-types`, `pnpm test`, `pnpm build`, validates the runtime package, and validates the current environment configuration. It writes a report next to the bundle staging directory so step 3 can honestly record real verification results instead of an unverified claim.

If preflight fails, stop here. Fix the failure and re-run. Do not build a release bundle from a failed preflight.

## 3. Build the release bundle

```
pnpm release:bundle:build
```

Reads the already-validated runtime package and the current `apps/web` source tree; writes a release bundle to the gitignored `services/release-pipeline/.local/release-bundle` directory. Prints the resulting `releaseVersion`. Nothing is deployed.

To thread rollback-compatibility information against a specific prior release, save that prior release's own `release-manifest.json` somewhere durable beforehand, then pass it:

```
pnpm --filter @repo/release-pipeline run release:bundle:build -- --previous-manifest <path-to-saved-manifest.json>
```

## 4. Validate the bundle

```
pnpm release:bundle:validate
```

Independently re-reads the bundle from disk and re-verifies every hash, the release identity, the file allowlist, and runs the security audit (secrets, absolute paths, symlinks, forbidden files). Non-zero exit on any failure.

## 5. Inspect

```
pnpm release:bundle:status      # one-line summary
pnpm release:bundle:inspect     # fuller safe JSON summary
```

## 6. Promote

```
pnpm release:promote -- --to validated
pnpm release:promote -- --to approved --dry-run
# or, with an operator name instead of --dry-run:
pnpm release:promote -- --to approved --operator "<your name>"
```

`validated` requires the bundle to pass `release:bundle:validate`. `approved` requires either `--dry-run` or an operator name (never an email address). `deployed` and `rolled-back` are not reachable — no provider integration exists yet.

## 7. Deployment dry-run

```
pnpm release:deploy:dry-run
```

Reads the validated bundle and prints a deployment plan: mount path, startup command sequence, readiness URL, rollback target, environment compatibility. **Performs no deployment, no network request, uses no credential, changes nothing.** This is the last step of TASK-049's scope — an actual deployment is a future, provider-specific task.

## 8. Smoke-test the current environment

```
pnpm release:smoke:local
```

In-process check (no HTTP server started) against whatever `REAL_PREDICTION_*`/`MODEL_INFERENCE_*` configuration is currently active in your shell — readiness, synthetic mode, historical catalog, a deterministic repeated prediction, and a safe-unavailable-state check.

## Cleaning up

```
pnpm release:bundle:clean -- --dry-run   # lists what would be deleted
pnpm release:bundle:clean                # deletes the bundle staging directory
```

Only ever touches the bundle staging directory — never a source directory, never the runtime package.
