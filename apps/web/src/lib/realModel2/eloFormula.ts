/**
 * Client-safe mirror of `services/vlr-ingestion/src/feature/elo.ts#expectedWinProbability`
 * (the standard logistic Elo formula, fixed 400-point scale) — duplicated
 * rather than imported because the ingestion service package is Node-only
 * and must never enter the browser bundle (see
 * `apps/web/src/server/clientBundleIsolation.test.ts`). A third, independent
 * copy of this one-line formula (Real Model 1.0's `real/eloSensitivity.ts`
 * has its own) rather than a cross-boundary import from `features/` into
 * `lib/` — `eloFormula.test.ts` asserts numeric parity with known Elo-formula
 * outputs so this stays correct if the real formula ever changes.
 */
export function expectedWinProbabilityFromElo(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}
