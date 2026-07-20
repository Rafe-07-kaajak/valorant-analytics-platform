# Rollback Runbook

Version: 1.0 (TASK-049)

**No step in this document executes a rollback automatically or runs a destructive command.** This runbook describes verification and manual decision points only — actual traffic-affecting rollback requires a provider-specific deployment task that does not exist yet.

There is no database in this stack. The only versioned artifacts are: the application source (pinned by `sourceCommitSha`), the runtime package (model + historical replay data), and configuration.

---

## Step 0 — Decide which kind of rollback you need

Three distinct concepts, easy to conflate:

| Kind | What changes | When to use |
|---|---|---|
| **Real-mode disablement** | `REAL_PREDICTION_ENABLED=false` (or leave `REAL_PREDICTION_REQUIRE_RUNTIME_PACKAGE=false` with no package mounted) | Fastest mitigation. No code or data change. Synthetic scenario mode remains fully functional — it has no dependency on the model or runtime package. **Try this first during an incident.** |
| **Runtime package rollback** | Re-mount a previously built `runtime-package/` directory | The model or historical data itself is suspect (wrong version, corrupted, mismatched feature schema) |
| **Application rollback** | Redeploy a previous release's application code (pinned by `sourceCommitSha`) | The application code itself is suspect |

## Step 1 — Generate/inspect the rollback manifest

```
pnpm release:rollback:manifest -- --previous-manifest <path-to-a-saved-prior-release-manifest.json>
```

Or read the one already inside a built bundle: `<bundle>/operations/rollback-manifest.json`.

Check `rollbackCompatible`. If `false`, read `rollbackBlockers` — most commonly a `featureSchemaVersion`/`featureRulesVersion` mismatch between the current and previous release, meaning an application-only rollback without also rolling back the runtime package risks a feature-contract mismatch.

## Step 2 — Application rollback (if needed)

1. Confirm the target release's own bundle still validates: `pnpm release:bundle:validate` against that release's saved bundle (or re-validate its saved `release-manifest.json` hashes by hand).
2. Check out `sourceCommitSha` from that release's manifest.
3. `pnpm install --frozen-lockfile && pnpm --filter web build && pnpm --filter web start` (see `operations/deployment-spec.json`).

## Step 3 — Runtime package rollback (if needed)

1. Re-mount the previous `runtime-package/` directory at the configured `REAL_PREDICTION_RUNTIME_PACKAGE_DIR` path.
2. If pinned, update `REAL_PREDICTION_EXPECTED_RUNTIME_PACKAGE_VERSION` to match.
3. Restart the process so the new mount is picked up (the loader memoizes a package for the process lifetime — see `docs/36`).

## Step 4 — Verify

Run the rollback verification checklist (also embedded in every generated `rollback-manifest.json`):

1. `pnpm release:bundle:validate` against the rolled-back release's bundle.
2. Confirm `REAL_PREDICTION_EXPECTED_RUNTIME_PACKAGE_VERSION` (if pinned) matches what's actually mounted.
3. `pnpm release:smoke:local` against the rolled-back environment.
4. Confirm the readiness endpoint (`/api/internal/prediction/readiness`) reports the expected `currentModelVersion`/`runtimePackageVersion`.
5. If any check fails, fall back to real-mode disablement (Step 0) while investigating further — never leave the environment in an unverified real-mode state.

## Emergency fallback

Synthetic scenario mode has no dependency on the model artifact, the runtime package, or any server-only prediction module. It is always the fastest, safest mitigation and should be the default first response to any real-prediction incident — see `operations/incident-response-real-prediction.md`.
