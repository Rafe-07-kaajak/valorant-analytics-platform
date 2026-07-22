import type { CuratedMatch } from "../curate/curatedExport";
import { buildNormalizedMatch } from "./normalizedMatchFixture";
import type { NormalizedMatch } from "../normalize/normalizedSchemas";

/**
 * Shared test-only builder for a minimal, valid `CuratedMatch` — the
 * curate-stage enrichment of `buildNormalizedMatch()` (TASK-057) that
 * feature-engineering tests need, since `runFeatureStateEngine` reads
 * curated matches, not raw normalized ones.
 */
export function buildCuratedMatch(overrides: Partial<CuratedMatch> = {}): CuratedMatch {
  const { teamADisplayName, teamBDisplayName, matchStageDisplay, ...normalizedOverrides } = overrides;
  const base = buildNormalizedMatch(normalizedOverrides as Partial<NormalizedMatch>);
  return {
    ...base,
    teamADisplayName: teamADisplayName ?? base.teamAId,
    teamBDisplayName: teamBDisplayName ?? base.teamBId,
    matchStageDisplay: matchStageDisplay ?? "unknown",
  };
}
