import type { VctRegionId, VctTeam } from "../../constants/vct";
import type { VctTeamProfile } from "@repo/prediction-engine";
import type { RealTeamPowerState } from "./realTeamPowerState";
import type { DataConfidence, PowerRankingEntry, PowerScoreExplainability } from "./rankingTypes";

/**
 * Power Rankings' Power Score — a deterministic composite of existing
 * `VctTeamProfile` fields (the same modeled dataset Comparison Lab and
 * Prediction Studio already use). Weights sum to 1; every input is already
 * bounded 0-100, so the result is always 0-100. No `Math.random()`, no
 * hidden state, no time dimension — calling this twice for the same profile
 * always returns the same number.
 *
 *   overallRating      35%  baseline strength
 *   recentFormIndex     25%  modeled current-form trend
 *   mapDepthScore       20%  breadth of strength across the map pool
 *   consistency         15%  alias of dna.adaptability
 *   clutchPerformance    5%  alias of dna.clutchAbility
 */
const OVERALL_RATING_WEIGHT = 0.35;
const RECENT_FORM_WEIGHT = 0.25;
const MAP_DEPTH_WEIGHT = 0.2;
const CONSISTENCY_WEIGHT = 0.15;
const CLUTCH_PERFORMANCE_WEIGHT = 0.05;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Mean of a team's modeled strength across every map in the current pool. Unrounded — only the final Power Score is rounded. */
export function computeMapDepthScore(profile: VctTeamProfile): number {
  const values = Object.values(profile.mapStrength);
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function computePowerScore(profile: VctTeamProfile, mapDepthScore: number): number {
  return round2(
    profile.overallRating * OVERALL_RATING_WEIGHT +
      profile.recentFormIndex * RECENT_FORM_WEIGHT +
      mapDepthScore * MAP_DEPTH_WEIGHT +
      profile.consistency * CONSISTENCY_WEIGHT +
      profile.clutchPerformance * CLUTCH_PERFORMANCE_WEIGHT,
  );
}

export type RankableEntry = Pick<PowerRankingEntry, "team" | "powerScore"> & { profile: VctTeamProfile };

/**
 * The single deterministic tie-break rule every sort in this feature uses:
 * `powerScore` descending, then `overallRating` descending, then `teamId`
 * ascending (lexicographic) as a final, always-decisive fallback. Exported
 * separately so the tie-break rule itself is unit-testable without building
 * a full ranking set.
 */
export function compareRankingEntries(a: RankableEntry, b: RankableEntry): number {
  if (b.powerScore !== a.powerScore) return b.powerScore - a.powerScore;
  if (b.profile.overallRating !== a.profile.overallRating) return b.profile.overallRating - a.profile.overallRating;
  return a.team.id < b.team.id ? -1 : a.team.id > b.team.id ? 1 : 0;
}

/**
 * Builds the full, fixed Power Rankings order in one pass: joins teams to
 * their profile, computes each score, sorts once with `compareRankingEntries`,
 * then assigns `globalRank` (position in the full sorted array) and
 * `regionalRank` (position within a running per-region counter — a
 * subsequence of the global order, never re-sorted). A team with no matching
 * profile is skipped rather than throwing, matching this app's existing
 * "never crash on missing modeled data" convention.
 */
export function buildPowerRankings(
  teams: readonly VctTeam[],
  profiles: readonly VctTeamProfile[],
): PowerRankingEntry[] {
  const profileByTeamId = new Map(profiles.map((profile) => [profile.teamId, profile]));

  type SyntheticRankedEntry = Omit<PowerRankingEntry, "globalRank" | "regionalRank" | "profile"> & { profile: VctTeamProfile };

  const unranked = teams.reduce<SyntheticRankedEntry[]>((entries, team) => {
    const profile = profileByTeamId.get(team.id);
    if (!profile) return entries;

    const mapDepthScore = computeMapDepthScore(profile);
    entries.push({
      team,
      profile,
      mapDepthScore,
      powerScore: computePowerScore(profile, mapDepthScore),
    });
    return entries;
  }, []);

  const sorted = [...unranked].sort(compareRankingEntries);

  const regionalCounters = new Map<VctRegionId, number>();

  return sorted.map((entry, index) => {
    const nextRegionalRank = (regionalCounters.get(entry.team.region) ?? 0) + 1;
    regionalCounters.set(entry.team.region, nextRegionalRank);

    return {
      ...entry,
      globalRank: index + 1,
      regionalRank: nextRegionalRank,
    };
  });
}

/** Groups the already-ranked entries by region in one pass. Compute once upstream and pass down — never re-filter the full list on every region-tab switch. */
export function groupEntriesByRegion(
  entries: readonly PowerRankingEntry[],
): Record<VctRegionId, PowerRankingEntry[]> {
  const grouped: Record<string, PowerRankingEntry[]> = {};
  for (const entry of entries) {
    const bucket = grouped[entry.team.region] ?? (grouped[entry.team.region] = []);
    bucket.push(entry);
  }
  return grouped as Record<VctRegionId, PowerRankingEntry[]>;
}

/**
 * Adapts the shared TASK-031 disclosure ("Predictions use...") for Power
 * Rankings, the same swap-the-leading-verb-phrase approach
 * `adaptDisclosureForComparison` already uses (`lib/teamComparison/summary.ts`)
 * rather than writing new disclaimer copy from scratch.
 */
export function adaptDisclosureForPowerRankings(disclosure: string): string {
  return disclosure.replace(/^Predictions use\b/, "These rankings use");
}

export interface RankingMapHighlight {
  mapId: string;
  score: number;
}

/**
 * Highest/lowest-scoring map in a profile's `mapStrength` record — a plain
 * min/max lookup over already-generated numbers (not a reimplementation of
 * the map-strength formula itself, which stays exclusively in
 * `services/prediction-engine`). Implemented locally, operating only on the
 * `mapStrength` data already passed down as a prop, rather than calling
 * `getStrongestVctMap`/`getWeakestVctMap` from `@repo/prediction-engine` at
 * runtime — that package also exports real server-only prediction code
 * (`generateVctPrediction.ts`, which needs `node:crypto`), and importing
 * *any* runtime value from its index from a client component pulls that
 * whole module graph into the browser bundle. Mirrors the same
 * client/server boundary `lib/teamComparison/maps.ts`'s `strongestMap`/
 * `weakestMap` already establish for Comparison Lab.
 */
export function strongestMapForProfile(profile: VctTeamProfile): RankingMapHighlight | null {
  const entries = Object.entries(profile.mapStrength);
  if (entries.length === 0) return null;
  const [mapId, score] = entries.reduce((best, entry) => (entry[1] > best[1] ? entry : best));
  return { mapId, score };
}

export function weakestMapForProfile(profile: VctTeamProfile): RankingMapHighlight | null {
  const entries = Object.entries(profile.mapStrength);
  if (entries.length === 0) return null;
  const [mapId, score] = entries.reduce((worst, entry) => (entry[1] < worst[1] ? entry : worst));
  return { mapId, score };
}

/**
 * `RankingTeamCard`/`SealedRankingCard` render "Recent form" from either
 * path without needing to know which one produced the entry: the synthetic
 * path always has `profile.recentFormIndex`, the real-data path always has
 * the top-level `recentFormIndex` (no `profile` at all — see
 * `rankingTypes.ts`'s doc comment on why the two are mutually exclusive).
 */
export function resolveRecentFormIndex(entry: PowerRankingEntry): number {
  return entry.profile?.recentFormIndex ?? entry.recentFormIndex ?? 0;
}

// ---------------------------------------------------------------------------
// Real-data Power Score (real-data-correction task)
// ---------------------------------------------------------------------------

/** A team needs at least this many canonical-window matches to be considered fully sampled — below it, every component shrinks toward the real population mean and `uncertaintyPenalty` grows. */
const WELL_SAMPLED_SERIES_THRESHOLD = 10;
/** Maximum point deduction for a team with the least possible sample size (always <= 0 on the resulting entry). */
const MAX_UNCERTAINTY_PENALTY = 15;

const BASE_RATING_WEIGHT_REAL = 0.35;
const FORM_WEIGHT_REAL = 0.25;
const OPPONENT_ADJUSTED_WEIGHT = 0.15;
const MAP_DEPTH_WEIGHT_REAL = 0.1;
const COMPETITION_TIER_WEIGHT = 0.1;
const CONSISTENCY_WEIGHT_REAL = 0.05;

/** `DEFAULT_ELO_CONFIG.initialRating`/spread from `services/vlr-ingestion/src/feature/versions.ts` — mirrors `teamRealDataState.ts`'s own rescale so a raw Elo rating becomes comparable to the other already-0-100 real components. */
function rescaleEloForDisplay(eloRating: number): number {
  if (!Number.isFinite(eloRating)) return 0;
  return Math.min(100, Math.max(0, 50 + ((eloRating - 1500) / 400) * 50));
}

export interface RealPopulationPriors {
  readonly recentFormIndex: number;
  readonly mapDepthScore: number;
  readonly consistency: number;
  readonly opponentAdjusted: number;
  readonly competitionTier: number;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 50;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Derived directly from the same real states being ranked — never a hardcoded assumption about a "typical" team. */
export function computeRealPopulationPriors(states: readonly RealTeamPowerState[]): RealPopulationPriors {
  return {
    recentFormIndex: mean(states.map((state) => state.recentFormIndex)),
    mapDepthScore: mean(states.map((state) => state.mapDepthScore)),
    consistency: mean(states.map((state) => state.consistency)),
    opponentAdjusted: mean(states.map((state) => state.opponentAdjusted)),
    competitionTier: mean(states.map((state) => state.competitionTier)),
  };
}

function shrinkTowardPrior(value: number, prior: number, seriesCountInWindow: number): number {
  const weight = Math.min(seriesCountInWindow / WELL_SAMPLED_SERIES_THRESHOLD, 1);
  return prior + (value - prior) * weight;
}

/** `identityVerified` reflects the team's identity-mapping registry status (`curated/identity-mappings.json`), independent of sample size. */
export function computeDataConfidence(state: RealTeamPowerState | undefined, identityVerified: boolean): DataConfidence {
  if (!state) return "unrated";
  if (identityVerified && state.seriesCountInWindow >= WELL_SAMPLED_SERIES_THRESHOLD) return "verified";
  return "provisional";
}

/**
 * Composite real-data Power Score. Every component besides `baseRating` is
 * shrunk toward the real population mean (`priors`) in proportion to
 * `seriesCountInWindow` — a team below `WELL_SAMPLED_SERIES_THRESHOLD`
 * matches never gets the same unshrunk confidence as a well-sampled team —
 * and a fixed `uncertaintyPenalty` (always <= 0, larger in magnitude for
 * less data) further separates them. `clutchPerformance` has no real
 * equivalent and is not included (see this module's file-level doc comment
 * precedent in `rankingTypes.ts`).
 */
export function computeRealPowerScore(state: RealTeamPowerState, priors: RealPopulationPriors): PowerScoreExplainability {
  const baseRating = round2(rescaleEloForDisplay(state.eloRating) * BASE_RATING_WEIGHT_REAL);
  const formContribution = round2(shrinkTowardPrior(state.recentFormIndex, priors.recentFormIndex, state.seriesCountInWindow) * FORM_WEIGHT_REAL);
  const opponentAdjustedContribution = round2(
    shrinkTowardPrior(state.opponentAdjusted, priors.opponentAdjusted, state.seriesCountInWindow) * OPPONENT_ADJUSTED_WEIGHT,
  );
  const mapDepthContribution = round2(shrinkTowardPrior(state.mapDepthScore, priors.mapDepthScore, state.seriesCountInWindow) * MAP_DEPTH_WEIGHT_REAL);
  const competitionTierContribution = round2(
    shrinkTowardPrior(state.competitionTier, priors.competitionTier, state.seriesCountInWindow) * COMPETITION_TIER_WEIGHT,
  );
  const consistencyContribution = round2(shrinkTowardPrior(state.consistency, priors.consistency, state.seriesCountInWindow) * CONSISTENCY_WEIGHT_REAL);
  const uncertaintyMagnitude = round2(MAX_UNCERTAINTY_PENALTY * Math.max(0, 1 - state.seriesCountInWindow / WELL_SAMPLED_SERIES_THRESHOLD));
  const uncertaintyPenalty = uncertaintyMagnitude === 0 ? 0 : -uncertaintyMagnitude;

  const finalScore = round2(
    baseRating + formContribution + opponentAdjustedContribution + mapDepthContribution + competitionTierContribution + consistencyContribution + uncertaintyPenalty,
  );

  return { baseRating, formContribution, opponentAdjustedContribution, mapDepthContribution, competitionTierContribution, consistencyContribution, uncertaintyPenalty, finalScore };
}

type RealRankableEntry = Pick<PowerRankingEntry, "team" | "powerScore" | "explainability">;

/** Real-data equivalent of `compareRankingEntries`: `powerScore` descending, then the Elo-derived `baseRating` contribution descending (a zero-data team's absent `explainability` sorts as 0 — the lowest possible), then `teamId` ascending. */
function compareRealRankingEntries(a: RealRankableEntry, b: RealRankableEntry): number {
  if (b.powerScore !== a.powerScore) return b.powerScore - a.powerScore;
  const aBase = a.explainability?.baseRating ?? 0;
  const bBase = b.explainability?.baseRating ?? 0;
  if (bBase !== aBase) return bBase - aBase;
  return a.team.id < b.team.id ? -1 : a.team.id > b.team.id ? 1 : 0;
}

/**
 * Builds the real-data Power Rankings order — parallel to (never replacing)
 * `buildPowerRankings`. A team absent from `states` (zero canonical-window-
 * eligible matches) is included as `dataConfidence: "unrated"` with
 * `powerScore: 0` and no `explainability` — the lowest possible score, so it
 * can never outrank a team with any real positive signal, rather than being
 * silently skipped or given a fabricated neutral default.
 */
export function buildRealPowerRankings(
  teams: readonly VctTeam[],
  states: ReadonlyMap<string, RealTeamPowerState>,
  verifiedTeamIds: ReadonlySet<string>,
): PowerRankingEntry[] {
  const priors = computeRealPopulationPriors([...states.values()]);

  const unranked: Omit<PowerRankingEntry, "globalRank" | "regionalRank">[] = teams.map((team) => {
    const state = states.get(team.id);
    const dataConfidence = computeDataConfidence(state, verifiedTeamIds.has(team.id));

    if (!state) {
      return { team, mapDepthScore: 0, powerScore: 0, recentFormIndex: 0, dataConfidence, seriesCountInWindow: 0 };
    }

    const explainability = computeRealPowerScore(state, priors);
    return {
      team,
      mapDepthScore: state.mapDepthScore,
      powerScore: explainability.finalScore,
      recentFormIndex: state.recentFormIndex,
      dataConfidence,
      explainability,
      seriesCountInWindow: state.seriesCountInWindow,
    };
  });

  const sorted = [...unranked].sort(compareRealRankingEntries);

  const regionalCounters = new Map<VctRegionId, number>();

  return sorted.map((entry, index) => {
    const nextRegionalRank = (regionalCounters.get(entry.team.region) ?? 0) + 1;
    regionalCounters.set(entry.team.region, nextRegionalRank);

    return { ...entry, globalRank: index + 1, regionalRank: nextRegionalRank };
  });
}
