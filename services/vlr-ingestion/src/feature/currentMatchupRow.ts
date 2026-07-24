import type { NormalizedEvent } from "../normalize/normalizedSchemas";
import type { CuratedMatch } from "../curate/curatedExport";
import { normalizeSeriesFormat } from "../normalize/seriesFormat";
import { TeamState } from "./teamState";
import { runFeatureStateEngine } from "./stateEngine";
import type { FeatureRowIdentifiers, MatchLevelFeatures, PrefixedTeamFeatures } from "./types";
import { buildTeamFeatureBlock } from "./types";
import type { EloConfig } from "./versions";
import { FEATURE_RULES_VERSION, FEATURE_SCHEMA_VERSION } from "./versions";

/**
 * Real, current (not historical-replay) prediction feature construction —
 * the "Flow B" capability docs/34/35 previously deferred as a substantial
 * online-feature-construction task. Builds one honest `FeatureRow`-shaped
 * object for an arbitrary, not-yet-scheduled team pairing "as of" a given
 * timestamp, reusing exactly the same state machinery
 * (`TeamState`/`HeadToHeadRegistry`/`EventCongestionRegistry`/Elo) the real
 * batch feature pipeline uses for every actual completed match — never a
 * separate, re-derived approximation of that math.
 *
 * What is genuinely real here: each team's own Elo, form, map history,
 * rest-days-since-last-real-match, and head-to-head record against the
 * other specific team — all derived from the full real curated history
 * replayed up to `asOfIso`. What is NOT real (because no match is actually
 * scheduled): competitive-tier/event context. Those fields are set directly
 * from the caller-supplied `MatchContext`, never guessed — see
 * `CurrentMatchupContext`'s own field docs.
 */
export interface CurrentMatchupContext {
  /** The instant this hypothetical matchup is evaluated "as of" — every real per-team signal (rest days, form windows) is computed relative to this timestamp. */
  readonly asOfIso: string;
  readonly seriesFormat: string;
  /** No event is actually scheduled, so this is the one place a caller-supplied assumption enters the row — always explicit, never defaulted silently. `"league"` requires `eventRegion` to be a single shared real VCT region; `"international"` represents a Masters/Champions-tier assumption. */
  readonly tournamentTier: "league" | "international";
  /** Real VCT region shared by both teams when `tournamentTier` is `"league"` — ignored (recorded as `"unknown"`, the same encoding every real international-event training row uses, since vlr.gg carries no region tag for Masters/Champions) otherwise. */
  readonly eventRegion: string;
}

export type CurrentMatchupRow = FeatureRowIdentifiers &
  PrefixedTeamFeatures<"teamA"> &
  PrefixedTeamFeatures<"teamB"> &
  MatchLevelFeatures;

/** No real match/event exists for a hypothetical current prediction — these are structural placeholders for the identifier fields every row must carry, never fed to the model (`requiredInputFields` never includes them) and never presented as real match/event identity. */
const HYPOTHETICAL_MATCH_ID = "hypothetical:current-matchup";
const HYPOTHETICAL_EVENT_ID = "hypothetical:no-scheduled-event";

function requireTeamState(teamStates: ReadonlyMap<string, TeamState>, teamId: string): TeamState {
  // A team with zero real curated match appearances gets a fresh cold-start
  // `TeamState` — the exact same convention the real batch pipeline already
  // uses for any team's first-ever match (`IsColdStart: true`, Elo at
  // `initialRating`, etc.), never a fabricated non-zero history.
  return teamStates.get(teamId) ?? new TeamState();
}

/**
 * Builds one real, honest pre-match feature row for `teamAId` vs `teamBId`,
 * "as of" `context.asOfIso`. Replays the full real curated history first
 * (via the unchanged, already-tested `runFeatureStateEngine`) to obtain the
 * final per-team/H2H/congestion/Elo state, then takes one further snapshot
 * for this specific hypothetical pairing — the same operation the real
 * engine performs for every actual match, just evaluated one step beyond
 * the last real one.
 */
export function buildCurrentMatchupRow(
  matches: readonly CuratedMatch[],
  eventsById: ReadonlyMap<string, NormalizedEvent>,
  teamAId: string,
  teamBId: string,
  context: CurrentMatchupContext,
  eloConfig: EloConfig,
  sourceDatasetVersion: string,
): CurrentMatchupRow {
  const { finalState } = runFeatureStateEngine(matches, eventsById, { eloConfig, sourceDatasetVersion });
  const { teamStates, players, h2h, congestion, eloState } = finalState;

  const asOfMs = Date.parse(context.asOfIso);
  const teamAState = requireTeamState(teamStates, teamAId);
  const teamBState = requireTeamState(teamStates, teamBId);

  const teamABlock = teamAState.snapshot({ nowMs: asOfMs, rosterPlayerIds: null, opponentTeamId: teamBId, players, eloState, eloConfig }, teamAId);
  const teamBBlock = teamBState.snapshot({ nowMs: asOfMs, rosterPlayerIds: null, opponentTeamId: teamAId, players, eloState, eloConfig }, teamBId);

  const isInternational = context.tournamentTier === "international";
  // "unknown" — not "international" — matches how every real Masters/Champions
  // training row is actually encoded: vlr.gg carries no region tag for
  // international events, so `eventContextState.ts` defaults `eventRegion` to
  // "unknown" at ingest time, and "international" was never a member of the
  // trained vocabulary in the first place.
  const eventRegion = isInternational ? "unknown" : context.eventRegion;
  const eventFamily = isInternational ? "masters" : `vct-${context.eventRegion}`;
  const tournamentLevel = isInternational ? "international" : "league";
  const asOfDate = new Date(asOfMs);
  const seasonYear = asOfDate.getUTCFullYear();
  const matchMonth = asOfDate.getUTCMonth() + 1;

  const h2hSnapshot = h2h.snapshot(teamAId, teamBId, asOfMs, eventFamily, eventRegion);

  const teamAMapNames = teamAState.recognizedMapNames();
  const teamBMapNames = teamBState.recognizedMapNames();
  const knownMapPoolOverlapCount = [...teamAMapNames].filter((name) => teamBMapNames.has(name)).length;

  const restDifferenceDays = teamABlock.DaysSinceLastMatch !== null && teamBBlock.DaysSinceLastMatch !== null ? teamABlock.DaysSinceLastMatch - teamBBlock.DaysSinceLastMatch : null;

  const row: CurrentMatchupRow = {
    matchInternalId: HYPOTHETICAL_MATCH_ID,
    providerMatchId: HYPOTHETICAL_MATCH_ID,
    scheduledAt: context.asOfIso,
    eventInternalId: HYPOTHETICAL_EVENT_ID,
    eventFamily,
    eventName: "Hypothetical current matchup (no scheduled event)",
    eventRegion,
    eventStage: "unknown",
    tournamentLevel,
    // Normalized through the same function real ingested matches use
    // (`normalizeSeriesFormat`), so a caller-supplied "BO3"/"BO5" is encoded
    // exactly like every real training row's series format ("bo3"/"bo5"),
    // never as an unnormalized passthrough that misses the trained vocabulary.
    seriesFormat: normalizeSeriesFormat(context.seriesFormat),
    teamAProviderId: teamAId,
    teamBProviderId: teamBId,
    teamADisplayName: teamAId,
    teamBDisplayName: teamBId,
    matchStageDisplay: "Hypothetical current matchup",
    sourceDatasetVersion,
    featureSchemaVersion: FEATURE_SCHEMA_VERSION,
    featureRulesVersion: FEATURE_RULES_VERSION,

    ...buildTeamFeatureBlock("teamA", teamABlock),
    ...buildTeamFeatureBlock("teamB", teamBBlock),

    eloRatingDiff: teamABlock.EloRating - teamBBlock.EloRating,
    eloRatingVersion: eloConfig.ratingVersion,
    knownMapPoolOverlapCount,
    mapStrengthDifferential: teamABlock.CumulativeMapWinRate - teamBBlock.CumulativeMapWinRate,

    h2hPriorMeetingCount: h2hSnapshot.priorMeetingCount,
    h2hTeamAWins: h2hSnapshot.teamAWins,
    h2hTeamBWins: h2hSnapshot.teamBWins,
    h2hTeamAWinRate: h2hSnapshot.teamAWinRate,
    h2hPriorMapDifferential: h2hSnapshot.priorMapDifferential,
    h2hMeetingsLast90Days: h2hSnapshot.meetingsLast90Days,
    h2hMeetingsLast180Days: h2hSnapshot.meetingsLast180Days,
    h2hMeetingsLast365Days: h2hSnapshot.meetingsLast365Days,
    h2hMostRecentMeetingWinnerProviderId: h2hSnapshot.mostRecentMeetingWinnerProviderId,
    h2hMeetingsSameEventFamily: h2hSnapshot.meetingsSameEventFamily,
    h2hMeetingsSameEventRegion: h2hSnapshot.meetingsSameEventRegion,

    restDifferenceDays,
    // No event is actually scheduled, so there is genuinely no congestion to report — 0 is the honest answer, not a fabricated one.
    eventStageMatchesLast3Days: congestion.matchesInLast3Days(HYPOTHETICAL_EVENT_ID, asOfMs),

    seasonYear,
    matchMonth,
    isInternationalEvent: isInternational,
    isRegionalLeague: !isInternational,
    isMastersOrChampions: isInternational,
  };

  return row;
}
