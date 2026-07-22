/**
 * Canonical pre-match feature-row contract — TASK-044 requirement 3. One
 * row per eligible completed match, in stable chronological order. Every
 * feature value represents state strictly before the match (see
 * `stateEngine.ts` for the emit-before-update guarantee). Flat by design:
 * no nested objects in the exported row beyond the fixed identifier/label
 * grouping below, so the table is directly usable as a training matrix in
 * TASK-045 without a flattening step.
 */

export type UnknownCategory = "unknown";

export interface FeatureRowIdentifiers {
  readonly matchInternalId: string;
  readonly providerMatchId: string;
  readonly scheduledAt: string;
  readonly eventInternalId: string;
  readonly eventFamily: string;
  /** Official event name (e.g. "Valorant Masters Santiago 2026") — display-only, never fed to the model; see `DISPLAY_ONLY_IDENTIFIER_FIELDS`. */
  readonly eventName: string;
  readonly eventRegion: string | UnknownCategory;
  readonly eventStage: string | UnknownCategory;
  readonly tournamentLevel: string;
  readonly seriesFormat: string;
  readonly teamAProviderId: string;
  readonly teamBProviderId: string;
  /** Human-readable team names for display — see `curate/curatedExport.ts`'s `CuratedMatch` doc comment for the resolution precedence. Display-only, never fed to the model. */
  readonly teamADisplayName: string;
  readonly teamBDisplayName: string;
  /** Per-match round/bracket text for display (e.g. "Grand Final Playoffs") — distinct from the ML `eventStage` feature above, and never fed to the model. */
  readonly matchStageDisplay: string;
  readonly sourceDatasetVersion: string;
  readonly featureSchemaVersion: string;
  readonly featureRulesVersion: string;
}

/**
 * Purely descriptive identifier fields with no bearing on any trained model
 * (never listed in a model's `requiredInputFields`) — excluded from the
 * per-row content hash that feeds `featureDatasetVersion` (see
 * `featureBuild.ts`) so that correcting or enriching display text never
 * invalidates an already-trained/selected model. Mirrors
 * `curate/curatedVersion.ts`'s existing choice to version curated matches
 * from `metadata.contentHash` rather than the full enriched object.
 */
export const DISPLAY_ONLY_IDENTIFIER_FIELDS = ["eventName", "teamADisplayName", "teamBDisplayName", "matchStageDisplay"] as const;

export interface FeatureRowLabels {
  readonly labelTeamAWin: 0 | 1;
  readonly labelWinnerProviderId: string;
  readonly labelSeriesScore: string;
  readonly labelMapCountPlayed: number;
}

/** Team-scoped features, duplicated for the `teamA`/`teamB` prefix via `buildTeamFeatureBlock`. */
export interface TeamFeatureBlock {
  readonly PriorMatchCount: number;
  readonly PriorWins: number;
  readonly PriorLosses: number;
  readonly CumulativeWinRate: number;
  readonly PriorMapsPlayed: number;
  readonly PriorMapWins: number;
  readonly PriorMapLosses: number;
  readonly CumulativeMapWinRate: number;
  readonly IsColdStart: boolean;

  readonly Last3MatchCount: number;
  readonly Last3WinRate: number;
  readonly Last5MatchCount: number;
  readonly Last5WinRate: number;
  readonly Last10MatchCount: number;
  readonly Last10WinRate: number;
  readonly Last30DayMatchCount: number;
  readonly Last30DayWinRate: number;
  readonly Last60DayMatchCount: number;
  readonly Last60DayWinRate: number;
  readonly RecentMapWinRateLast10: number;
  readonly RecentAvgMapsWonLast10: number;
  readonly RecentAvgMapsLostLast10: number;
  readonly FormTrend: number;

  readonly EloRating: number;
  readonly EloWinProbability: number;

  readonly AvgOpponentEloLast5: number;
  readonly AvgOpponentEloLast10: number;
  readonly AvgOpponentWinRateLast5: number;
  readonly AvgOpponentWinRateLast10: number;
  readonly StrengthOfScheduleAllTime: number;
  readonly WinsVsAboveMedianOpponentCount: number;
  readonly LossesVsBelowMedianOpponentCount: number;

  readonly MapPoolBreadth: number;
  readonly TopMapConcentration: number;
  readonly MapExperienceEntropy: number;
  readonly UnknownMapCount: number;
  readonly AvgRoundsWonPerMap: number;
  readonly AvgRoundsLostPerMap: number;
  readonly HasAttackDefenseSplitData: boolean;
  readonly AttackSideWinRate: number;
  readonly DefenseSideWinRate: number;

  readonly DaysSinceLastMatch: number | null;
  readonly HasPriorMatch: boolean;
  readonly HoursSinceLastMatch: number | null;
  readonly MatchesLast7Days: number;
  readonly MatchesLast14Days: number;
  readonly MatchesLast30Days: number;
  readonly MapsLast7Days: number;
  readonly MapsLast14Days: number;
  readonly MapsLast30Days: number;
  readonly IsBackToBack: boolean;
  readonly SameDayMatchCountBeforeGroup: number;
  readonly InactivityFlag: boolean;

  readonly RosterSnapshotAvailable: boolean;
  readonly RosterSize: number;
  readonly PlayersWithPriorTeamAppearanceCount: number;
  readonly RosterContinuityVsPreviousMatch: number;
  readonly RosterContinuityLast3Matches: number;
  readonly SharedPriorMatchesAmongRosterAvg: number;
  readonly RosterAvgPlayerPriorAppearances: number;
  readonly RosterMinPlayerPriorAppearances: number;
  readonly RosterMaxPlayerPriorAppearances: number;
  readonly RosterDebutingPlayerCount: number;
  readonly DaysSinceRosterLastAppearedTogether: number | null;
  readonly RosterAvgPlayerPriorWins: number;
  readonly RosterAvgPlayerRecentAppearances30Days: number;
  readonly RosterPriorInternationalAppearances: number;
  readonly RosterPriorMastersChampionsAppearances: number;
}

export type PrefixedTeamFeatures<Prefix extends string> = {
  [K in keyof TeamFeatureBlock as `${Prefix}${K}`]: TeamFeatureBlock[K];
};

export interface MatchLevelFeatures {
  readonly eloRatingDiff: number;
  readonly eloRatingVersion: string;
  readonly knownMapPoolOverlapCount: number;
  readonly mapStrengthDifferential: number;

  readonly h2hPriorMeetingCount: number;
  readonly h2hTeamAWins: number;
  readonly h2hTeamBWins: number;
  readonly h2hTeamAWinRate: number;
  readonly h2hPriorMapDifferential: number;
  readonly h2hMeetingsLast90Days: number;
  readonly h2hMeetingsLast180Days: number;
  readonly h2hMeetingsLast365Days: number;
  readonly h2hMostRecentMeetingWinnerProviderId: string | UnknownCategory;
  readonly h2hMeetingsSameEventFamily: number;
  readonly h2hMeetingsSameEventRegion: number;

  readonly restDifferenceDays: number | null;
  readonly eventStageMatchesLast3Days: number;

  readonly seasonYear: number;
  readonly matchMonth: number;
  readonly isInternationalEvent: boolean;
  readonly isRegionalLeague: boolean;
  readonly isMastersOrChampions: boolean;
}

export type FeatureRow = FeatureRowIdentifiers &
  PrefixedTeamFeatures<"teamA"> &
  PrefixedTeamFeatures<"teamB"> &
  MatchLevelFeatures &
  FeatureRowLabels;

export function buildTeamFeatureBlock<Prefix extends string>(prefix: Prefix, block: TeamFeatureBlock): PrefixedTeamFeatures<Prefix> {
  const result = {} as Record<string, unknown>;
  for (const [key, value] of Object.entries(block)) {
    result[`${prefix}${key}`] = value;
  }
  return result as PrefixedTeamFeatures<Prefix>;
}
