/**
 * Client-safe mirror of `services/vlr-ingestion/src/feature/elo.ts#expectedWinProbability`
 * (the standard logistic Elo formula, fixed 400-point scale, no other
 * config). Duplicated rather than imported because the ingestion service
 * package is Node-only and must never enter the browser bundle (see
 * `apps/web/src/server/clientBundleIsolation.test.ts`); `eloSensitivity.test.ts`
 * asserts numeric parity against known Elo-formula outputs so this stays in
 * sync if the real formula ever changes.
 *
 * Used only for the Real Context Simulator's "Elo Sensitivity" control: a
 * genuinely real, honest hypothetical (the same math the deployed
 * elo-baseline estimator itself runs), never a fabricated probability.
 */
export function expectedWinProbabilityFromElo(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}
