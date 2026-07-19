import type { TeamFeatureBlock } from "./types";
import type { PlayerRegistry } from "./playerState";
import { expectedWinProbability, getEloRating } from "./elo";
import type { EloState } from "./elo";
import type { EloConfig } from "./versions";

const DAY_MS = 86_400_000;

interface TeamMatchRecord {
  readonly matchInternalId: string;
  readonly timestampMs: number;
  readonly won: boolean;
  readonly mapsWon: number;
  readonly mapsLost: number;
  readonly opponentTeamId: string;
  readonly opponentEloAtEncounter: number;
  readonly opponentWinRateAtEncounter: number;
  readonly opponentAboveMedianAtEncounter: boolean;
  readonly eventInternalId: string;
}

interface MapStatEntry {
  played: number;
  won: number;
}

interface RosterSnapshotRecord {
  readonly matchInternalId: string;
  readonly timestampMs: number;
  readonly playerIds: readonly string[];
}

/** One played map instance, as observed strictly for state-update purposes (never read back as a pre-match input for its own match). */
export interface PlayedMapInstance {
  readonly mapName: string;
  readonly recognized: boolean;
  readonly teamScore: number;
  readonly opponentScore: number;
  readonly teamAttackScore?: number;
  readonly teamDefenseScore?: number;
  readonly opponentAttackScore?: number;
  readonly opponentDefenseScore?: number;
}

export interface RecordResultInput {
  readonly matchInternalId: string;
  readonly timestampMs: number;
  readonly won: boolean;
  readonly opponentTeamId: string;
  readonly opponentEloAtEncounter: number;
  readonly opponentWinRateAtEncounter: number;
  readonly opponentAboveMedianAtEncounter: boolean;
  readonly eventInternalId: string;
  readonly mapInstances: readonly PlayedMapInstance[];
  readonly rosterPlayerIds: readonly string[] | null;
}

export interface TeamSnapshotInput {
  readonly nowMs: number;
  readonly rosterPlayerIds: readonly string[] | null;
  readonly opponentTeamId: string;
  readonly players: PlayerRegistry;
  readonly eloState: EloState;
  readonly eloConfig: EloConfig;
}

function average(values: readonly number[], fallback: number): number {
  return values.length === 0 ? fallback : values.reduce((sum, v) => sum + v, 0) / values.length;
}

function sameCalendarDayUtc(aMs: number, bMs: number): boolean {
  return new Date(aMs).toISOString().slice(0, 10) === new Date(bMs).toISOString().slice(0, 10);
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Mutable per-team temporal state — TASK-044 requirements 5–8 and 12. Every
 * read method (`snapshot`) reflects only matches recorded via
 * `recordResult` so far; the state engine guarantees `recordResult` is
 * never called for the current timestamp group until every row in that
 * group has already been snapshotted (see `stateEngine.ts`).
 */
export class TeamState {
  private readonly matchHistory: TeamMatchRecord[] = [];
  private readonly mapStats = new Map<string, MapStatEntry>();
  private unknownMapCount = 0;
  private roundsWonTotal = 0;
  private roundsLostTotal = 0;
  private attackRoundsWonTotal = 0;
  private attackRoundsPlayedTotal = 0;
  private defenseRoundsWonTotal = 0;
  private defenseRoundsPlayedTotal = 0;
  private readonly rosterHistory: RosterSnapshotRecord[] = [];
  private readonly rosterSetLastSeenMs = new Map<string, number>();
  private readonly sharedMatchCounts = new Map<string, number>();

  /** Distinct recognized map names this team has played, as of the current (pre-group) state — used only for the match-level `knownMapPoolOverlapCount` feature. */
  recognizedMapNames(): ReadonlySet<string> {
    return new Set(this.mapStats.keys());
  }

  snapshot(input: TeamSnapshotInput, teamId: string): TeamFeatureBlock {
    const { nowMs, rosterPlayerIds, opponentTeamId, players, eloState, eloConfig } = input;

    const priorMatchCount = this.matchHistory.length;
    const priorWins = this.matchHistory.filter((m) => m.won).length;
    const priorLosses = priorMatchCount - priorWins;
    const cumulativeWinRate = priorMatchCount > 0 ? priorWins / priorMatchCount : 0.5;
    const priorMapsPlayed = this.matchHistory.reduce((sum, m) => sum + m.mapsWon + m.mapsLost, 0);
    const priorMapWins = this.matchHistory.reduce((sum, m) => sum + m.mapsWon, 0);
    const priorMapLosses = priorMapsPlayed - priorMapWins;
    const cumulativeMapWinRate = priorMapsPlayed > 0 ? priorMapWins / priorMapsPlayed : 0.5;

    const last3 = this.matchHistory.slice(-3);
    const last5 = this.matchHistory.slice(-5);
    const last10 = this.matchHistory.slice(-10);
    const last30Day = this.matchHistory.filter((m) => m.timestampMs >= nowMs - 30 * DAY_MS);
    const last60Day = this.matchHistory.filter((m) => m.timestampMs >= nowMs - 60 * DAY_MS);

    const winRateOf = (records: readonly TeamMatchRecord[]): number => (records.length > 0 ? records.filter((m) => m.won).length / records.length : 0.5);
    const last5WinRate = winRateOf(last5);
    const last10WinRate = winRateOf(last10);

    const last10MapsWon = last10.reduce((sum, m) => sum + m.mapsWon, 0);
    const last10MapsLost = last10.reduce((sum, m) => sum + m.mapsLost, 0);

    const recognizedMapEntries = [...this.mapStats.values()];
    const totalRecognizedMapsPlayed = recognizedMapEntries.reduce((sum, e) => sum + e.played, 0);
    const maxRecognizedMapPlayed = recognizedMapEntries.reduce((max, e) => Math.max(max, e.played), 0);
    const entropy = (() => {
      if (recognizedMapEntries.length <= 1 || totalRecognizedMapsPlayed === 0) return 0;
      const h = recognizedMapEntries.reduce((sum, e) => {
        const p = e.played / totalRecognizedMapsPlayed;
        return p > 0 ? sum - p * Math.log2(p) : sum;
      }, 0);
      return h / Math.log2(recognizedMapEntries.length);
    })();
    const totalMapsForRounds = totalRecognizedMapsPlayed + this.unknownMapCount;

    const lastMatch = this.matchHistory[this.matchHistory.length - 1];
    const daysSinceLastMatch = lastMatch ? (nowMs - lastMatch.timestampMs) / DAY_MS : null;
    const hoursSinceLastMatch = lastMatch ? (nowMs - lastMatch.timestampMs) / 3_600_000 : null;

    const matchesSince = (days: number): TeamMatchRecord[] => this.matchHistory.filter((m) => m.timestampMs >= nowMs - days * DAY_MS);
    const matchesLast7 = matchesSince(7);
    const matchesLast14 = matchesSince(14);
    const matchesLast30 = matchesSince(30);
    const mapsIn = (records: readonly TeamMatchRecord[]): number => records.reduce((sum, m) => sum + m.mapsWon + m.mapsLost, 0);

    // The running median itself is read by the state engine at recordResult
    // time (frozen per-encounter into `opponentAboveMedianAtEncounter`),
    // never recomputed retroactively here.
    const winsVsAboveMedian = this.matchHistory.filter((m) => m.won && m.opponentAboveMedianAtEncounter).length;
    const lossesVsBelowMedian = this.matchHistory.filter((m) => !m.won && !m.opponentAboveMedianAtEncounter).length;

    // Roster continuity.
    const rosterAvailable = rosterPlayerIds !== null && rosterPlayerIds.length > 0;
    const previousRoster = this.rosterHistory[this.rosterHistory.length - 1];
    const rosterContinuityVsPrevious = (() => {
      if (!rosterAvailable || !previousRoster) return 0;
      const previousSet = new Set(previousRoster.playerIds);
      const currentSet = new Set(rosterPlayerIds);
      const intersection = [...currentSet].filter((id) => previousSet.has(id)).length;
      const union = new Set([...currentSet, ...previousSet]).size;
      return union > 0 ? intersection / union : 0;
    })();
    const rosterContinuityLast3 = (() => {
      if (!rosterAvailable) return 0;
      const recentRosters = this.rosterHistory.slice(-3);
      const unionOfRecent = new Set(recentRosters.flatMap((r) => r.playerIds));
      const overlap = rosterPlayerIds.filter((id) => unionOfRecent.has(id)).length;
      return rosterPlayerIds.length > 0 ? overlap / rosterPlayerIds.length : 0;
    })();
    const sharedPriorMatchesAvg = (() => {
      if (!rosterAvailable || rosterPlayerIds.length < 2) return 0;
      const pairs: number[] = [];
      for (let i = 0; i < rosterPlayerIds.length; i += 1) {
        for (let j = i + 1; j < rosterPlayerIds.length; j += 1) {
          pairs.push(this.sharedMatchCounts.get(pairKey(rosterPlayerIds[i]!, rosterPlayerIds[j]!)) ?? 0);
        }
      }
      return average(pairs, 0);
    })();
    const playersWithPriorTeamAppearanceCount = rosterAvailable
      ? rosterPlayerIds.filter((id) => this.rosterHistory.some((r) => r.playerIds.includes(id))).length
      : 0;
    const daysSinceRosterTogether = (() => {
      if (!rosterAvailable) return null;
      const key = [...rosterPlayerIds].sort().join(",");
      const lastSeenMs = this.rosterSetLastSeenMs.get(key);
      return lastSeenMs === undefined ? null : (nowMs - lastSeenMs) / DAY_MS;
    })();
    const priorAppearanceCounts = rosterAvailable ? rosterPlayerIds.map((id) => players.priorAppearanceCount(id)) : [];

    const ownRating = getEloRating(eloState, teamId, eloConfig);
    const opponentRating = getEloRating(eloState, opponentTeamId, eloConfig);

    return {
      PriorMatchCount: priorMatchCount,
      PriorWins: priorWins,
      PriorLosses: priorLosses,
      CumulativeWinRate: cumulativeWinRate,
      PriorMapsPlayed: priorMapsPlayed,
      PriorMapWins: priorMapWins,
      PriorMapLosses: priorMapLosses,
      CumulativeMapWinRate: cumulativeMapWinRate,
      IsColdStart: priorMatchCount === 0,

      Last3MatchCount: last3.length,
      Last3WinRate: winRateOf(last3),
      Last5MatchCount: last5.length,
      Last5WinRate: last5WinRate,
      Last10MatchCount: last10.length,
      Last10WinRate: last10WinRate,
      Last30DayMatchCount: last30Day.length,
      Last30DayWinRate: winRateOf(last30Day),
      Last60DayMatchCount: last60Day.length,
      Last60DayWinRate: winRateOf(last60Day),
      RecentMapWinRateLast10: last10MapsWon + last10MapsLost > 0 ? last10MapsWon / (last10MapsWon + last10MapsLost) : 0.5,
      RecentAvgMapsWonLast10: average(last10.map((m) => m.mapsWon), 0),
      RecentAvgMapsLostLast10: average(last10.map((m) => m.mapsLost), 0),
      FormTrend: last5WinRate - last10WinRate,

      EloRating: ownRating,
      EloWinProbability: expectedWinProbability(ownRating, opponentRating),

      AvgOpponentEloLast5: average(last5.map((m) => m.opponentEloAtEncounter), eloConfig.initialRating),
      AvgOpponentEloLast10: average(last10.map((m) => m.opponentEloAtEncounter), eloConfig.initialRating),
      AvgOpponentWinRateLast5: average(last5.map((m) => m.opponentWinRateAtEncounter), 0.5),
      AvgOpponentWinRateLast10: average(last10.map((m) => m.opponentWinRateAtEncounter), 0.5),
      StrengthOfScheduleAllTime: average(this.matchHistory.map((m) => m.opponentEloAtEncounter), eloConfig.initialRating),
      WinsVsAboveMedianOpponentCount: winsVsAboveMedian,
      LossesVsBelowMedianOpponentCount: lossesVsBelowMedian,

      MapPoolBreadth: recognizedMapEntries.length,
      TopMapConcentration: totalRecognizedMapsPlayed > 0 ? maxRecognizedMapPlayed / totalRecognizedMapsPlayed : 0,
      MapExperienceEntropy: entropy,
      UnknownMapCount: this.unknownMapCount,
      AvgRoundsWonPerMap: totalMapsForRounds > 0 ? this.roundsWonTotal / totalMapsForRounds : 0,
      AvgRoundsLostPerMap: totalMapsForRounds > 0 ? this.roundsLostTotal / totalMapsForRounds : 0,
      HasAttackDefenseSplitData: this.attackRoundsPlayedTotal > 0 || this.defenseRoundsPlayedTotal > 0,
      AttackSideWinRate: this.attackRoundsPlayedTotal > 0 ? this.attackRoundsWonTotal / this.attackRoundsPlayedTotal : 0.5,
      DefenseSideWinRate: this.defenseRoundsPlayedTotal > 0 ? this.defenseRoundsWonTotal / this.defenseRoundsPlayedTotal : 0.5,

      DaysSinceLastMatch: daysSinceLastMatch,
      HasPriorMatch: lastMatch !== undefined,
      HoursSinceLastMatch: hoursSinceLastMatch,
      MatchesLast7Days: matchesLast7.length,
      MatchesLast14Days: matchesLast14.length,
      MatchesLast30Days: matchesLast30.length,
      MapsLast7Days: mapsIn(matchesLast7),
      MapsLast14Days: mapsIn(matchesLast14),
      MapsLast30Days: mapsIn(matchesLast30),
      IsBackToBack: daysSinceLastMatch !== null && daysSinceLastMatch < 1,
      SameDayMatchCountBeforeGroup: this.matchHistory.filter((m) => sameCalendarDayUtc(m.timestampMs, nowMs)).length,
      InactivityFlag: daysSinceLastMatch !== null && daysSinceLastMatch > 30,

      RosterSnapshotAvailable: rosterAvailable,
      RosterSize: rosterAvailable ? rosterPlayerIds.length : 0,
      PlayersWithPriorTeamAppearanceCount: playersWithPriorTeamAppearanceCount,
      RosterContinuityVsPreviousMatch: rosterContinuityVsPrevious,
      RosterContinuityLast3Matches: rosterContinuityLast3,
      SharedPriorMatchesAmongRosterAvg: sharedPriorMatchesAvg,
      RosterAvgPlayerPriorAppearances: average(priorAppearanceCounts, 0),
      RosterMinPlayerPriorAppearances: priorAppearanceCounts.length > 0 ? Math.min(...priorAppearanceCounts) : 0,
      RosterMaxPlayerPriorAppearances: priorAppearanceCounts.length > 0 ? Math.max(...priorAppearanceCounts) : 0,
      RosterDebutingPlayerCount: rosterAvailable ? rosterPlayerIds.filter((id) => !players.hasAppeared(id)).length : 0,
      DaysSinceRosterLastAppearedTogether: daysSinceRosterTogether,
      RosterAvgPlayerPriorWins: rosterAvailable ? average(rosterPlayerIds.map((id) => players.priorWinCount(id)), 0) : 0,
      RosterAvgPlayerRecentAppearances30Days: rosterAvailable ? average(rosterPlayerIds.map((id) => players.priorAppearancesSince(id, nowMs - 30 * DAY_MS)), 0) : 0,
      RosterPriorInternationalAppearances: rosterAvailable ? rosterPlayerIds.reduce((sum, id) => sum + players.priorInternationalAppearanceCount(id), 0) : 0,
      RosterPriorMastersChampionsAppearances: rosterAvailable ? rosterPlayerIds.reduce((sum, id) => sum + players.priorMastersChampionsAppearanceCount(id), 0) : 0,
    };
  }

  /** Applies a completed match's result to this team's state. Must only be called after every row in the current timestamp group has been snapshotted. */
  recordResult(input: RecordResultInput): void {
    const mapsWon = input.mapInstances.filter((m) => m.teamScore > m.opponentScore).length;
    const mapsLost = input.mapInstances.length - mapsWon;

    this.matchHistory.push({
      matchInternalId: input.matchInternalId,
      timestampMs: input.timestampMs,
      won: input.won,
      mapsWon,
      mapsLost,
      opponentTeamId: input.opponentTeamId,
      opponentEloAtEncounter: input.opponentEloAtEncounter,
      opponentWinRateAtEncounter: input.opponentWinRateAtEncounter,
      opponentAboveMedianAtEncounter: input.opponentAboveMedianAtEncounter,
      eventInternalId: input.eventInternalId,
    });

    for (const instance of input.mapInstances) {
      this.roundsWonTotal += instance.teamScore;
      this.roundsLostTotal += instance.opponentScore;

      if (instance.recognized) {
        const entry = this.mapStats.get(instance.mapName) ?? { played: 0, won: 0 };
        entry.played += 1;
        if (instance.teamScore > instance.opponentScore) entry.won += 1;
        this.mapStats.set(instance.mapName, entry);
      } else {
        this.unknownMapCount += 1;
      }

      if (instance.teamAttackScore !== undefined && instance.opponentDefenseScore !== undefined) {
        this.attackRoundsWonTotal += instance.teamAttackScore;
        this.attackRoundsPlayedTotal += instance.teamAttackScore + instance.opponentDefenseScore;
      }
      if (instance.teamDefenseScore !== undefined && instance.opponentAttackScore !== undefined) {
        this.defenseRoundsWonTotal += instance.teamDefenseScore;
        this.defenseRoundsPlayedTotal += instance.teamDefenseScore + instance.opponentAttackScore;
      }
    }

    if (input.rosterPlayerIds && input.rosterPlayerIds.length > 0) {
      this.rosterHistory.push({ matchInternalId: input.matchInternalId, timestampMs: input.timestampMs, playerIds: input.rosterPlayerIds });
      const key = [...input.rosterPlayerIds].sort().join(",");
      this.rosterSetLastSeenMs.set(key, input.timestampMs);
      for (let i = 0; i < input.rosterPlayerIds.length; i += 1) {
        for (let j = i + 1; j < input.rosterPlayerIds.length; j += 1) {
          const key2 = pairKey(input.rosterPlayerIds[i]!, input.rosterPlayerIds[j]!);
          this.sharedMatchCounts.set(key2, (this.sharedMatchCounts.get(key2) ?? 0) + 1);
        }
      }
    }
  }
}
