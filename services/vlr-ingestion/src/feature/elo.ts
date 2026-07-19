import type { EloConfig } from "./versions";

/**
 * Deterministic Elo baseline — TASK-044 requirement 6. A feature/baseline
 * signal for TASK-045, not a claim of a final production model. Pre-match
 * ratings and expected win probability are always read before any update is
 * applied (the state engine enforces "emit before update" — see
 * `stateEngine.ts`); this module itself is pure math with no ordering
 * concerns of its own.
 */
export interface EloState {
  readonly ratingByTeamId: Map<string, number>;
}

export function createEloState(): EloState {
  return { ratingByTeamId: new Map() };
}

export function getEloRating(state: EloState, teamId: string, config: EloConfig): number {
  return state.ratingByTeamId.get(teamId) ?? config.initialRating;
}

/** Probability team A beats team B, given each team's current pre-match rating. */
export function expectedWinProbability(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/**
 * Applies a single completed match's result to both teams' ratings.
 * Deliberately conservative: a binary win/loss outcome only, no
 * margin-of-victory multiplier from map score or series score — VLR map
 * scores are not treated as a validated strength-margin signal, so using
 * them to scale the K-factor would be an unjustified assumption. Mutates
 * `state` in place and must only be called strictly after the pre-match
 * rating has already been read for feature-row emission.
 */
export function applyEloUpdate(state: EloState, teamAId: string, teamBId: string, teamAWon: boolean, config: EloConfig): void {
  const ratingA = getEloRating(state, teamAId, config);
  const ratingB = getEloRating(state, teamBId, config);
  const expectedA = expectedWinProbability(ratingA, ratingB);
  const actualA = teamAWon ? 1 : 0;
  state.ratingByTeamId.set(teamAId, ratingA + config.kFactor * (actualA - expectedA));
  state.ratingByTeamId.set(teamBId, ratingB + config.kFactor * (1 - actualA - (1 - expectedA)));
}
