import type { VctTeam } from "../../constants/vct";
import type { VctTeamProfile } from "@repo/prediction-engine";

/**
 * Real-data confidence tier (see `rankingModel.ts`'s `computeRealPowerScore`
 * and this app's server-side Power Rankings data layer). Absent
 * (`undefined`) on a `PowerRankingEntry` means the synthetic-scenario path
 * built it — that path carries no confidence concept of its own.
 *
 * - `verified`: identity mapping is verified AND the team has enough
 *   canonical-window match history to be considered well-sampled.
 * - `provisional`: either the identity mapping isn't fully verified, or the
 *   team has some but not enough real match history yet.
 * - `unrated`: no canonical-window-eligible match history at all — never
 *   eligible for rank #1 (see `buildRealPowerRankings`).
 */
export type DataConfidence = "verified" | "provisional" | "unrated";

/**
 * The additive components behind a real-data team's Power Score — must sum
 * exactly to `finalScore` (unit-tested in `realPowerRankingPolicy.test.ts`).
 * `clutchPerformance` from the synthetic formula has no real equivalent in
 * the ingested feature set and is deliberately absent here, not faked with a
 * misleading proxy.
 */
export interface PowerScoreExplainability {
  /** Elo, rescaled onto a 0-100 display band. */
  baseRating: number;
  formContribution: number;
  opponentAdjustedContribution: number;
  mapDepthContribution: number;
  competitionTierContribution: number;
  consistencyContribution: number;
  /** Always <= 0; larger in magnitude for a team with less canonical-window match history. */
  uncertaintyPenalty: number;
  finalScore: number;
}

/**
 * One team's position in the Power Rankings, computed once by
 * `buildPowerRankings`/`buildRealPowerRankings` (see `rankingModel.ts`).
 * `globalRank`/`regionalRank` are precomputed here rather than derived at
 * render time so every view (podium, board, regional tabs, dossier) reads
 * the same fixed order.
 *
 * `profile`/`explainability` are mutually exclusive in practice: the
 * synthetic path (`buildPowerRankings`) always sets `profile` and never
 * `dataConfidence`/`explainability`/`seriesCountInWindow`; the real-data path
 * (`buildRealPowerRankings`) is the reverse. Both paths always set
 * `mapDepthScore`/`powerScore`/`globalRank`/`regionalRank`.
 */
export interface PowerRankingEntry {
  team: VctTeam;
  /** Present only for the synthetic-scenario path. */
  profile?: VctTeamProfile;
  /** Present only for the real-data path — `profile` is absent there, so this is how real-path-aware components read current form without fabricating a full `VctTeamProfile`. */
  recentFormIndex?: number;
  /** Mean of `profile.mapStrength` (synthetic) or the real map-depth aggregate (real) — unrounded. */
  mapDepthScore: number;
  /** The deterministic composite score (see `rankingModel.ts`), rounded to 2 decimals. */
  powerScore: number;
  /** 1-based position across all eligible teams. */
  globalRank: number;
  /** 1-based position within `profile.region` only. */
  regionalRank: number;
  /** Present only for the real-data path. */
  dataConfidence?: DataConfidence;
  /** Present only for the real-data path. */
  explainability?: PowerScoreExplainability;
  /** Present only for the real-data path — the sample-size basis for `dataConfidence`. */
  seriesCountInWindow?: number;
}

export type RankingMode = "global" | "regional";
