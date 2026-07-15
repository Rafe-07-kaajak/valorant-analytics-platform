# TASK-027

## Title

Environment & Deployment Configuration Review

---

## Sprint

Sprint 06

---

## Objective

Verify that the application builds and deploys from a clean environment using only the documented environment variables, and confirm the deployment process is repeatable without manual intervention.

---

## Rationale

`docs/17-production-deployment.md` ("Final Verification") requires confirming, before every production deployment, that "the application builds successfully," "environment variables are configured," and "deployment succeeds without manual intervention." README documents exactly one environment variable (`NEXT_PUBLIC_SITE_URL`, optional, defaulting to `http://localhost:3000`) and states no database or external API credentials are required because the Prediction Engine runs in-process against synthetic data.

This task verifies that documented reality still holds after Sprints 02–05 (which added new modules but no new external dependencies) and produces a clean-environment build verification, using the CI pipeline from TASK-025 as the mechanism.

---

## Implementation Requirements

- Confirm `pnpm install && pnpm build` succeeds from a clean checkout (no local `node_modules`, no cached Turbo output) with only `NEXT_PUBLIC_SITE_URL` set (or unset, relying on its documented default).
- Confirm no task completed in Sprints 02–05 introduced an undocumented required environment variable, secret, or external network dependency; if one was introduced, document it in the README's Environment Variables table (the only doc explicitly scoped to environment configuration).
- Confirm the TASK-025 CI workflow's build step reflects this same clean-environment path (no reliance on local machine state).
- Record the deployment target's configuration (e.g. build command, output mode, required env vars) needed for a one-click deploy, without provisioning or committing to a specific hosting provider unless one is already in use.

---

## Acceptance Criteria

- [ ] A clean-environment `pnpm install && pnpm build` succeeds using only documented environment variables.
- [ ] Any undocumented environment variable/secret discovered during the review is either removed or added to README's Environment Variables table.
- [ ] The CI workflow (TASK-025) is confirmed to build under the same clean-environment conditions.
- [ ] Findings are recorded in the task completion summary (no unnecessary new documentation files).

---

## Dependencies

TASK-025

---

## Status

TODO

---

## Notes

If this review finds that README's documentation is already accurate and no undocumented configuration exists, that is a valid and expected outcome — this task exists to verify, not to invent new deployment infrastructure.
