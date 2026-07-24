import type { NormalizedEvent } from "../normalize/normalizedSchemas";
import type { CuratedMatch } from "../curate/curatedExport";
import { groupMatchesChronologically } from "./chronology";
import { TeamState } from "./teamState";
import { PlayerRegistry } from "./playerState";
import { HeadToHeadRegistry } from "./h2hState";
import { EventCongestionRegistry, deriveEventContextFeatures } from "./eventContextState";
import { RunningMedianTracker } from "./median";
import { createEloState, applyEloUpdate } from "./elo";
import type { EloState } from "./elo";
import { buildMatchLabels } from "./labels";
import { actuallyPlayedMaps, extractPlayedMapInstancesForTeam } from "./mapInstances";
import { buildTeamFeatureBlock } from "./types";
import type { FeatureRow } from "./types";
import type { EloConfig } from "./versions";
import { FEATURE_RULES_VERSION, FEATURE_SCHEMA_VERSION } from "./versions";

export interface RejectedMatch {
  readonly matchInternalId: string;
  readonly reason: string;
}

/**
 * The fully-replayed-through-history state registries, as they stand after
 * the last chronological group has been processed — exposed so a caller can
 * take one further, honest "as of now" snapshot for a hypothetical team
 * pairing (see `currentMatchupRow.ts`) without re-deriving or duplicating
 * this replay. Never mutated by a caller — treat as read-only.
 */
export interface ReplayedChronologicalState {
  readonly teamStates: ReadonlyMap<string, TeamState>;
  readonly players: PlayerRegistry;
  readonly h2h: HeadToHeadRegistry;
  readonly congestion: EventCongestionRegistry;
  readonly eloState: EloState;
}

export interface StateEngineResult {
  readonly rows: readonly FeatureRow[];
  readonly rejected: readonly RejectedMatch[];
  readonly finalState: ReplayedChronologicalState;
}

export interface StateEngineOptions {
  readonly eloConfig: EloConfig;
  readonly sourceDatasetVersion: string;
  /** Bounded replay for tests — process only the first N chronological groups, otherwise every group. */
  readonly maxGroups?: number;
}

function rosterFor(match: CuratedMatch, teamId: string): readonly string[] | null {
  const roster = match.rosterSnapshots?.find((r) => r.teamInternalId === teamId);
  return roster && roster.playerInternalIds.length > 0 ? roster.playerInternalIds : null;
}

/**
 * The provider-neutral chronological feature-state engine — TASK-044
 * requirement 4. Processes every timestamp group in two strict phases:
 *
 * 1. Emit — every match in the group reads team/player/H2H/event state that
 *    reflects only strictly-earlier groups, and its feature row is built.
 * 2. Update — only after every row in the group has been built, each
 *    match's result is applied to team/player/H2H/Elo/congestion state and
 *    the running Elo-median tracker.
 *
 * This ordering is what guarantees no same-timestamp match can leak into
 * another, and that a match's own result never influences its own row.
 */
export function runFeatureStateEngine(matches: readonly CuratedMatch[], eventsById: ReadonlyMap<string, NormalizedEvent>, options: StateEngineOptions): StateEngineResult {
  const rejected: RejectedMatch[] = [];

  // A match with no unambiguously-normalized timestamp cannot be
  // chronologically ordered at all — reject rather than guess a position.
  const orderableMatches = matches.filter((match) => {
    if (match.scheduledAt.iso !== null) return true;
    rejected.push({ matchInternalId: match.internalId, reason: `Match "${match.internalId}" has no unambiguously-normalized scheduled timestamp and cannot be chronologically ordered.` });
    return false;
  });

  const groups = groupMatchesChronologically(orderableMatches).slice(0, options.maxGroups ?? Number.MAX_SAFE_INTEGER);

  const teamStates = new Map<string, TeamState>();
  const players = new PlayerRegistry();
  const h2h = new HeadToHeadRegistry();
  const congestion = new EventCongestionRegistry();
  const eloState = createEloState();
  const medianTracker = new RunningMedianTracker();

  const rows: FeatureRow[] = [];

  const getTeamState = (teamId: string): TeamState => {
    let state = teamStates.get(teamId);
    if (!state) {
      state = new TeamState();
      teamStates.set(teamId, state);
    }
    return state;
  };

  for (const group of groups) {
    const medianBeforeGroup = medianTracker.median(options.eloConfig.initialRating);

    interface PendingUpdate {
      readonly match: CuratedMatch;
      readonly event: NormalizedEvent;
      readonly nowMs: number;
      readonly rosterA: readonly string[] | null;
      readonly rosterB: readonly string[] | null;
      readonly teamAEloAtEmission: number;
      readonly teamBEloAtEmission: number;
      readonly teamACumulativeWinRateAtEmission: number;
      readonly teamBCumulativeWinRateAtEmission: number;
    }
    const pendingUpdates: PendingUpdate[] = [];

    // Phase 1 — emit every row in the group from the identical pre-group state.
    for (const match of group.matches) {
      const event = eventsById.get(match.eventId);
      if (!event) {
        rejected.push({ matchInternalId: match.internalId, reason: `Missing event record "${match.eventId}" for match "${match.internalId}".` });
        continue;
      }

      const labelResult = buildMatchLabels(match);
      if (!labelResult.valid) {
        rejected.push({ matchInternalId: match.internalId, reason: labelResult.reason ?? "Invalid label." });
        continue;
      }

      // Guaranteed non-null: matches without a normalized timestamp were
      // already filtered out and rejected before chronological grouping.
      const scheduledAtIso = match.scheduledAt.iso!;
      const nowMs = Date.parse(scheduledAtIso);
      const rosterA = rosterFor(match, match.teamAId);
      const rosterB = rosterFor(match, match.teamBId);

      const teamAState = getTeamState(match.teamAId);
      const teamBState = getTeamState(match.teamBId);

      const teamABlock = teamAState.snapshot({ nowMs, rosterPlayerIds: rosterA, opponentTeamId: match.teamBId, players, eloState, eloConfig: options.eloConfig }, match.teamAId);
      const teamBBlock = teamBState.snapshot({ nowMs, rosterPlayerIds: rosterB, opponentTeamId: match.teamAId, players, eloState, eloConfig: options.eloConfig }, match.teamBId);

      const eventContext = deriveEventContextFeatures(event, scheduledAtIso);
      const h2hSnapshot = h2h.snapshot(match.teamAId, match.teamBId, nowMs, event.eventFamily, eventContext.eventRegion);

      const teamAMapNames = teamAState.recognizedMapNames();
      const teamBMapNames = teamBState.recognizedMapNames();
      const knownMapPoolOverlapCount = [...teamAMapNames].filter((name) => teamBMapNames.has(name)).length;

      const restDifferenceDays = teamABlock.DaysSinceLastMatch !== null && teamBBlock.DaysSinceLastMatch !== null ? teamABlock.DaysSinceLastMatch - teamBBlock.DaysSinceLastMatch : null;

      const row: FeatureRow = {
        matchInternalId: match.internalId,
        providerMatchId: match.sourceReference.externalId,
        scheduledAt: scheduledAtIso,
        eventInternalId: event.internalId,
        eventFamily: event.eventFamily,
        eventName: event.name,
        eventRegion: eventContext.eventRegion,
        eventStage: eventContext.eventStage,
        tournamentLevel: event.tournamentLevel,
        seriesFormat: match.seriesFormat,
        teamAProviderId: match.teamAId,
        teamBProviderId: match.teamBId,
        teamADisplayName: match.teamADisplayName,
        teamBDisplayName: match.teamBDisplayName,
        matchStageDisplay: match.matchStageDisplay,
        sourceDatasetVersion: options.sourceDatasetVersion,
        featureSchemaVersion: FEATURE_SCHEMA_VERSION,
        featureRulesVersion: FEATURE_RULES_VERSION,

        ...buildTeamFeatureBlock("teamA", teamABlock),
        ...buildTeamFeatureBlock("teamB", teamBBlock),

        eloRatingDiff: teamABlock.EloRating - teamBBlock.EloRating,
        eloRatingVersion: options.eloConfig.ratingVersion,
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
        eventStageMatchesLast3Days: congestion.matchesInLast3Days(event.internalId, nowMs),

        seasonYear: eventContext.seasonYear,
        matchMonth: eventContext.matchMonth,
        isInternationalEvent: eventContext.isInternationalEvent,
        isRegionalLeague: eventContext.isRegionalLeague,
        isMastersOrChampions: eventContext.isMastersOrChampions,

        ...labelResult.labels!,
      };

      rows.push(row);
      pendingUpdates.push({
        match,
        event,
        nowMs,
        rosterA,
        rosterB,
        teamAEloAtEmission: teamABlock.EloRating,
        teamBEloAtEmission: teamBBlock.EloRating,
        teamACumulativeWinRateAtEmission: teamABlock.CumulativeWinRate,
        teamBCumulativeWinRateAtEmission: teamBBlock.CumulativeWinRate,
      });
    }

    // Phase 2 — apply every result in the group, still using only the
    // pre-group Elo/win-rate/median values captured during phase 1.
    for (const update of pendingUpdates) {
      const { match, event, nowMs, rosterA, rosterB, teamAEloAtEmission, teamBEloAtEmission, teamACumulativeWinRateAtEmission, teamBCumulativeWinRateAtEmission } = update;
      const teamAWon = match.winnerId === match.teamAId;
      const playedMaps = actuallyPlayedMaps(match);
      const teamAMapWins = playedMaps.filter((m) => (m.teamAScore as number) > (m.teamBScore as number)).length;
      const teamBMapWins = playedMaps.length - teamAMapWins;

      getTeamState(match.teamAId).recordResult({
        matchInternalId: match.internalId,
        timestampMs: nowMs,
        won: teamAWon,
        opponentTeamId: match.teamBId,
        opponentEloAtEncounter: teamBEloAtEmission,
        opponentWinRateAtEncounter: teamBCumulativeWinRateAtEmission,
        opponentAboveMedianAtEncounter: teamBEloAtEmission > medianBeforeGroup,
        eventInternalId: event.internalId,
        mapInstances: extractPlayedMapInstancesForTeam(match, "teamA"),
        rosterPlayerIds: rosterA,
      });
      getTeamState(match.teamBId).recordResult({
        matchInternalId: match.internalId,
        timestampMs: nowMs,
        won: !teamAWon,
        opponentTeamId: match.teamAId,
        opponentEloAtEncounter: teamAEloAtEmission,
        opponentWinRateAtEncounter: teamACumulativeWinRateAtEmission,
        opponentAboveMedianAtEncounter: teamAEloAtEmission > medianBeforeGroup,
        eventInternalId: event.internalId,
        mapInstances: extractPlayedMapInstancesForTeam(match, "teamB"),
        rosterPlayerIds: rosterB,
      });

      applyEloUpdate(eloState, match.teamAId, match.teamBId, teamAWon, options.eloConfig);

      const eventContext = deriveEventContextFeatures(event, match.scheduledAt.iso!);
      h2h.recordResult({
        timestampMs: nowMs,
        teamAId: match.teamAId,
        teamBId: match.teamBId,
        winnerTeamId: match.winnerId as string,
        mapsWonByTeamA: teamAMapWins,
        mapsWonByTeamB: teamBMapWins,
        eventFamily: event.eventFamily,
        eventRegion: eventContext.eventRegion,
      });

      congestion.recordMatch(event.internalId, nowMs);

      for (const [rosterPlayerIds, teamId, won] of [
        [rosterA, match.teamAId, teamAWon] as const,
        [rosterB, match.teamBId, !teamAWon] as const,
      ]) {
        for (const playerId of rosterPlayerIds ?? []) {
          players.recordAppearance(playerId, {
            matchInternalId: match.internalId,
            timestampMs: nowMs,
            teamInternalId: teamId,
            won,
            isInternational: eventContext.isInternationalEvent,
            isMastersOrChampions: eventContext.isMastersOrChampions,
          });
        }
      }
    }

    // Only after the whole group has applied its updates do this group's
    // own pre-match ratings become part of the median tracker's history —
    // guarantees the next group's median never reflects this group early.
    for (const update of pendingUpdates) {
      medianTracker.push(update.teamAEloAtEmission);
      medianTracker.push(update.teamBEloAtEmission);
    }
  }

  return { rows, rejected, finalState: { teamStates, players, h2h, congestion, eloState } };
}
