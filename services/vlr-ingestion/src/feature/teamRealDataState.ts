import { isEligibleForCanonicalWindow } from "./canonicalWindow";
import type { CanonicalWindow } from "./canonicalWindow";
import type { FeatureRow } from "./types";

/**
 * Per-team real-data state derived entirely from TASK-044's own engineered
 * features — no synthetic generator, no fabricated dimension. Every field is
 * 0-100 (except `seriesCountInWindow`/`eloRating`) so `computeRealPowerScore`
 * (apps/web's `rankingModel.ts`) can combine them without re-deriving scale
 * knowledge. Identity-mapping confidence (verified/provisional/unrated) is
 * deliberately NOT computed here — that requires joining against
 * `curated/identity-mappings.json`, which only the caller
 * (`apps/web/src/server/prediction/powerRankingsRepository.ts`) has loaded.
 */
export interface RealTeamPowerState {
  readonly teamId: string;
  /** Count of this team's canonical-window-eligible matches (both sides) — the sample-size basis for confidence tiering and uncertainty shrinkage. */
  readonly seriesCountInWindow: number;
  readonly eloRating: number;
  readonly recentFormIndex: number;
  readonly mapDepthScore: number;
  readonly consistency: number;
  readonly opponentAdjusted: number;
  readonly competitionTier: number;
}

/** Mirrors `services/prediction-engine/src/data/maps.ts`'s full historical map list — the denominator for map-pool breadth, not a guess. */
const TOTAL_KNOWN_MAPS = 13;
/** `DEFAULT_ELO_CONFIG.initialRating` (`feature/versions.ts`) — the rescale midpoint. */
const ELO_RESCALE_MIDPOINT = 1500;
/** A ±400 Elo band is the typical meaningful spread this dataset's ratings occupy; used only to rescale onto a 0-100 display range, never fed back into any model. */
const ELO_RESCALE_SPREAD = 400;

function clampTo100(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function rescaleElo(elo: number): number {
  return clampTo100(50 + ((elo - ELO_RESCALE_MIDPOINT) / ELO_RESCALE_SPREAD) * 50);
}

interface TeamSideRow {
  readonly scheduledAt: string;
  readonly eloRating: number;
  readonly last10WinRate: number;
  readonly last10MatchCount: number;
  readonly cumulativeWinRate: number;
  readonly mapPoolBreadth: number;
  readonly recentMapWinRateLast10: number;
  readonly avgRoundsWonPerMap: number;
  readonly avgOpponentEloLast10: number;
  readonly isMastersOrChampions: boolean;
  readonly isInternationalEvent: boolean;
  readonly isRegionalLeague: boolean;
}

function extractTeamSideRow(row: FeatureRow, side: "teamA" | "teamB"): TeamSideRow {
  const block =
    side === "teamA"
      ? {
          eloRating: row.teamAEloRating,
          last10WinRate: row.teamALast10WinRate,
          last10MatchCount: row.teamALast10MatchCount,
          cumulativeWinRate: row.teamACumulativeWinRate,
          mapPoolBreadth: row.teamAMapPoolBreadth,
          recentMapWinRateLast10: row.teamARecentMapWinRateLast10,
          avgRoundsWonPerMap: row.teamAAvgRoundsWonPerMap,
          avgOpponentEloLast10: row.teamAAvgOpponentEloLast10,
        }
      : {
          eloRating: row.teamBEloRating,
          last10WinRate: row.teamBLast10WinRate,
          last10MatchCount: row.teamBLast10MatchCount,
          cumulativeWinRate: row.teamBCumulativeWinRate,
          mapPoolBreadth: row.teamBMapPoolBreadth,
          recentMapWinRateLast10: row.teamBRecentMapWinRateLast10,
          avgRoundsWonPerMap: row.teamBAvgRoundsWonPerMap,
          avgOpponentEloLast10: row.teamBAvgOpponentEloLast10,
        };

  return {
    scheduledAt: row.scheduledAt,
    ...block,
    isMastersOrChampions: row.isMastersOrChampions,
    isInternationalEvent: row.isInternationalEvent,
    isRegionalLeague: row.isRegionalLeague,
  };
}

/**
 * Builds one `RealTeamPowerState` per team observed in canonical-window-
 * eligible rows (both `teamA`/`teamB` sides). Every field is derived from the
 * team's own most recent eligible row (its current, warmed-up state) except
 * `competitionTier`, which weighs the team's *entire* in-window match history
 * so a single low-stakes match doesn't erase a season of international play.
 * A team with zero eligible rows never appears in the returned map — callers
 * must treat an absent team as "unrated," never default to a neutral score.
 */
export function buildTeamRealDataStates(rows: readonly FeatureRow[], window: CanonicalWindow): ReadonlyMap<string, RealTeamPowerState> {
  const eligibleRows = rows.filter((row) => isEligibleForCanonicalWindow(row.scheduledAt, window));

  const rowsByTeam = new Map<string, TeamSideRow[]>();
  for (const row of eligibleRows) {
    for (const side of ["teamA", "teamB"] as const) {
      const teamId = side === "teamA" ? row.teamAProviderId : row.teamBProviderId;
      const list = rowsByTeam.get(teamId) ?? [];
      list.push(extractTeamSideRow(row, side));
      rowsByTeam.set(teamId, list);
    }
  }

  const states = new Map<string, RealTeamPowerState>();
  for (const [teamId, teamRows] of rowsByTeam) {
    const sorted = [...teamRows].sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : a.scheduledAt > b.scheduledAt ? 1 : 0));
    const latest = sorted[sorted.length - 1]!;
    const seriesCountInWindow = sorted.length;

    const recentFormIndex = clampTo100((latest.last10MatchCount > 0 ? latest.last10WinRate : latest.cumulativeWinRate) * 100);
    const consistency = clampTo100(100 - Math.abs(latest.last10WinRate - latest.cumulativeWinRate) * 100);
    const opponentAdjusted = rescaleElo(latest.avgOpponentEloLast10);

    const mapPoolComponent = clampTo100((latest.mapPoolBreadth / TOTAL_KNOWN_MAPS) * 100);
    const mapWinRateComponent = clampTo100(latest.recentMapWinRateLast10 * 100);
    const roundsComponent = clampTo100((latest.avgRoundsWonPerMap / 13) * 100);
    const mapDepthScore = clampTo100((mapPoolComponent + mapWinRateComponent + roundsComponent) / 3);

    const tierWeightSum = sorted.reduce(
      (sum, r) => sum + (r.isMastersOrChampions ? 1 : r.isInternationalEvent ? 0.6 : r.isRegionalLeague ? 0.3 : 0.1),
      0,
    );
    const competitionTier = clampTo100((tierWeightSum / seriesCountInWindow) * 100);

    states.set(teamId, {
      teamId,
      seriesCountInWindow,
      eloRating: latest.eloRating,
      recentFormIndex,
      mapDepthScore,
      consistency,
      opponentAdjusted,
      competitionTier,
    });
  }

  return states;
}
