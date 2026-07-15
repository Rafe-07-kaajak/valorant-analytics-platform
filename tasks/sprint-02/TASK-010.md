# TASK-010

## Title

Prediction Request Contract Alignment

---

## Sprint

Sprint 02

---

## Objective

Extend the `PredictionRequest` contract with the `clientVersion` and `timestamp` fields required by the documented Prediction Request Lifecycle, and wire them through the frontend request and backend validation.

---

## Rationale

`docs/04-prediction-request-lifecycle.md` (Stage 3 — API Request) specifies that the payload sent to `POST /prediction` must contain: Prediction Request, Scenario Configuration, Client Version, Timestamp, and Request ID. The current `PredictionRequest` contract (`packages/shared/src/types/prediction.ts`) only contains `requestId` and `scenario`. `docs/11-shared-contracts.md` requires contracts to evolve through versioning rather than silent expansion, so this field addition should be treated as an explicit, backward-considered contract change.

This is a small, well-bounded gap between the documented lifecycle and the current implementation, and it is a prerequisite for later confidence/trust-score work (Sprint 03) that references pipeline and scenario reliability.

---

## Implementation Requirements

- Add `clientVersion: string` and `timestamp: string` to `PredictionRequest` in `packages/shared/src/types/prediction.ts`.
- Populate both fields in `apps/web/src/lib/api/predictMatch.ts` when constructing the request (client version can be a static constant for now; timestamp is the ISO time of request construction).
- Extend `services/prediction-engine/src/validateScenario.ts` to reject requests missing `clientVersion` or `timestamp`, returning the same style of user-facing validation message as existing checks.
- Update `services/prediction-engine/src/generatePrediction.ts` only if needed to keep existing behavior (predictions must remain deterministic and reproducible).

---

## Acceptance Criteria

- [ ] `PredictionRequest` includes `clientVersion` and `timestamp`.
- [ ] The frontend always sends both fields on every prediction request.
- [ ] `validateScenario` rejects a request missing either field with a clear error message.
- [ ] Existing unit tests (`validateScenario.test.ts`, `generatePrediction.test.ts`) are updated to reflect the new required fields and pass.
- [ ] `e2e/prediction-studio.spec.ts` continues to pass unmodified in behavior (only fixture/request construction changes if needed).
- [ ] `pnpm check-types`, `pnpm lint`, and `pnpm test` pass.

---

## Dependencies

None

---

## Status

DONE

---

## Notes

Do not introduce request signing, authentication, or rate limiting — those are outside the documented Version 1 scope. This task only closes the contract gap between `docs/04-prediction-request-lifecycle.md` and the current implementation.
