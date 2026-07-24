/**
 * Plain, client-safe mirror of the real-data ingestion package's own
 * `RealTeamPowerState` type (see `services/vlr-ingestion/src/feature/teamRealDataState.ts`)
 * — deliberately NOT imported from that package here (this app's
 * client-bundle-isolation check forbids referencing it anywhere under this
 * directory). This file hand-mirrors the shape instead; TypeScript's
 * structural typing means the real object built by this app's server-side
 * Power Rankings data layer satisfies this interface without any cast.
 * Keep this in sync with the source interface if it ever changes.
 */
export interface RealTeamPowerState {
  readonly teamId: string;
  readonly seriesCountInWindow: number;
  readonly eloRating: number;
  readonly recentFormIndex: number;
  readonly mapDepthScore: number;
  readonly consistency: number;
  readonly opponentAdjusted: number;
  readonly competitionTier: number;
}
