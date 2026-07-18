/**
 * Raw VLR ingestion schemas — see docs/29-vlr-data-ingestion-foundation.md
 * ("Raw vs Normalized Data") and TASK-041 requirement 6.
 *
 * These types model exactly what a VLR page parse can observe. Optional
 * fields are genuinely optional: a parser must never fabricate a value to
 * fill one in. `RawSourceMetadata` is embedded in every record so a raw
 * record is always traceable back to the exact page and moment it came
 * from, per docs/06-data-architecture.md ("Layer 1 — Raw Storage").
 */

export interface RawSourceMetadata {
  readonly sourceUrl: string;
  readonly fetchedAt: string; // ISO 8601 timestamp
  readonly parserVersion: string;
}

export interface VlrTeam {
  readonly vlrTeamId: string;
  readonly name: string;
  readonly shortName?: string;
  readonly region?: string;
  readonly profileUrl: string;
  readonly logoUrl?: string;
  /** VLR player IDs on the roster at fetch time, if the page exposed them. */
  readonly activeRosterVlrPlayerIds?: readonly string[];
  readonly source: RawSourceMetadata;
}

export interface VlrPlayer {
  readonly vlrPlayerId: string;
  readonly handle: string;
  readonly realName?: string;
  readonly country?: string;
  readonly profileUrl: string;
  readonly teamVlrTeamId?: string;
  readonly source: RawSourceMetadata;
}

export type VlrEventStatus = "upcoming" | "ongoing" | "completed";

export interface VlrEvent {
  readonly vlrEventId: string;
  readonly name: string;
  readonly status: VlrEventStatus;
  /** Raw displayed date text, preserved verbatim alongside any normalized value. */
  readonly startDateRaw?: string;
  readonly startDateIso?: string;
  readonly endDateRaw?: string;
  readonly endDateIso?: string;
  readonly region?: string;
  readonly eventUrl: string;
  readonly season?: string;
  readonly stage?: string;
  readonly tournamentLevelRaw?: string;
  readonly parentSeries?: string;
  /** Raw category/label metadata found on the page (e.g. a badge or breadcrumb), for classification evidence. */
  readonly rawCategoryLabels?: readonly string[];
  readonly source: RawSourceMetadata;
}

export type VlrMatchStatus = "upcoming" | "live" | "completed" | "postponed" | "cancelled";

export interface VlrMatchSummary {
  readonly vlrMatchId: string;
  readonly matchUrl: string;
  readonly teamAVlrTeamId: string;
  readonly teamBVlrTeamId: string;
  readonly scheduledAtRaw?: string;
  readonly scheduledAtIso?: string;
  readonly status: VlrMatchStatus;
  readonly vlrEventId: string;
  readonly roundStageText?: string;
  readonly seriesFormatRaw?: string;
  readonly source: RawSourceMetadata;
}

export interface VlrMapResult {
  readonly mapNameRaw: string;
  readonly order: number;
  /** `null` marks a map slot that was never played (best-of not fully contested), distinct from a genuine 0–0 result. */
  readonly teamAScore: number | null;
  readonly teamBScore: number | null;
  readonly teamAAttackScore?: number;
  readonly teamADefenseScore?: number;
  readonly teamBAttackScore?: number;
  readonly teamBDefenseScore?: number;
  readonly winnerVlrTeamId?: string;
  readonly overtime: boolean;
}

export interface VlrMatchDetail {
  readonly vlrMatchId: string;
  readonly matchUrl: string;
  readonly teamAVlrTeamId: string;
  readonly teamBVlrTeamId: string;
  readonly winnerVlrTeamId?: string;
  readonly seriesFormatRaw?: string;
  readonly maps: readonly VlrMapResult[];
  readonly vlrEventId: string;
  readonly rostersAtMatchTime?: readonly { readonly teamVlrTeamId: string; readonly vlrPlayerIds: readonly string[] }[];
  readonly patch?: string;
  readonly status: VlrMatchStatus;
  readonly scheduledAtRaw?: string;
  readonly scheduledAtIso?: string;
  readonly source: RawSourceMetadata;
}
