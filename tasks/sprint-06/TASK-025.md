# TASK-025

## Title

Continuous Integration Pipeline

---

## Sprint

Sprint 06

---

## Objective

Add a GitHub Actions workflow that runs lint, type-checking, unit tests, and build on every push and pull request, matching the "predictable and repeatable" release verification required for production.

---

## Rationale

`docs/17-production-deployment.md` ("Final Verification") requires that "the application builds successfully" and that "every release should be predictable and repeatable" before production readiness is claimed. README's "Verify" section already documents the exact commands a human runs locally (`pnpm lint`, `pnpm check-types`, `pnpm test`, `pnpm test:e2e`, `pnpm build`), but no automation currently runs them — the repository has no `.github/workflows` directory at all.

This is the first Phase 6 task because every later Sprint 06 task (SEO review, deployment config, final sign-off) depends on having an automated, repeatable verification gate rather than manual spot-checks.

---

## Implementation Requirements

- Add `.github/workflows/ci.yml` that triggers on push and pull request to the main branch.
- The workflow must run, in order: install dependencies (`pnpm install`), `pnpm lint`, `pnpm check-types`, `pnpm test`, `pnpm build`.
- Use the Node.js and pnpm versions already declared in the root `package.json` (`engines.node >= 20`, `packageManager: pnpm@11.10.0`).
- Do not add `pnpm test:e2e` to this workflow unless Playwright browser installation is also configured within the same job — if browser setup adds meaningful complexity, it may be split into a separate, clearly-named job or deferred with a note in this task's completion summary rather than left silently missing.
- Do not introduce any new dependency beyond what CI itself requires (GitHub Actions runner setup actions).

---

## Acceptance Criteria

- [ ] `.github/workflows/ci.yml` exists and is syntactically valid.
- [ ] The workflow runs lint, check-types, test, and build on every push/PR to main.
- [ ] The workflow passes against the current state of the repository.
- [ ] Node/pnpm versions in the workflow match `package.json`'s declared `engines`/`packageManager`.

---

## Dependencies

None

---

## Status

TODO

---

## Notes

If e2e is deferred to a follow-up rather than included here, state that explicitly in the task completion summary so TASK-028 (final sign-off) can account for it.
