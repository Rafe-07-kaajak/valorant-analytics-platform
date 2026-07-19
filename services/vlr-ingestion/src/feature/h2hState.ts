const DAY_MS = 86_400_000;

interface H2HRecord {
  readonly timestampMs: number;
  readonly recordedTeamAId: string;
  readonly recordedTeamBId: string;
  readonly winnerTeamId: string;
  readonly mapsWonByRecordedTeamA: number;
  readonly mapsWonByRecordedTeamB: number;
  readonly eventFamily: string;
  readonly eventRegion: string;
}

export interface RecordH2HInput {
  readonly timestampMs: number;
  readonly teamAId: string;
  readonly teamBId: string;
  readonly winnerTeamId: string;
  readonly mapsWonByTeamA: number;
  readonly mapsWonByTeamB: number;
  readonly eventFamily: string;
  readonly eventRegion: string;
}

export interface H2HSnapshot {
  readonly priorMeetingCount: number;
  readonly teamAWins: number;
  readonly teamBWins: number;
  readonly teamAWinRate: number;
  readonly priorMapDifferential: number;
  readonly meetingsLast90Days: number;
  readonly meetingsLast180Days: number;
  readonly meetingsLast365Days: number;
  readonly mostRecentMeetingWinnerProviderId: string;
  readonly meetingsSameEventFamily: number;
  readonly meetingsSameEventRegion: number;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Head-to-head history — TASK-044 requirement 9. Keyed by the unordered
 * team pair so rematches (teamA/teamB swapped across meetings) are still
 * recognized as the same rivalry, while `snapshot` re-orients every stored
 * record to the *current* match's team A/B orientation before aggregating.
 */
export class HeadToHeadRegistry {
  private readonly recordsByPair = new Map<string, H2HRecord[]>();

  snapshot(teamAId: string, teamBId: string, nowMs: number, currentEventFamily: string, currentEventRegion: string): H2HSnapshot {
    const records = this.recordsByPair.get(pairKey(teamAId, teamBId)) ?? [];

    let teamAWins = 0;
    let teamBWins = 0;
    let mapDifferential = 0;
    let meetingsLast90Days = 0;
    let meetingsLast180Days = 0;
    let meetingsLast365Days = 0;
    let meetingsSameEventFamily = 0;
    let meetingsSameEventRegion = 0;

    for (const record of records) {
      if (record.winnerTeamId === teamAId) teamAWins += 1;
      else if (record.winnerTeamId === teamBId) teamBWins += 1;

      const orientedMapsA = record.recordedTeamAId === teamAId ? record.mapsWonByRecordedTeamA : record.mapsWonByRecordedTeamB;
      const orientedMapsB = record.recordedTeamAId === teamAId ? record.mapsWonByRecordedTeamB : record.mapsWonByRecordedTeamA;
      mapDifferential += orientedMapsA - orientedMapsB;

      const ageMs = nowMs - record.timestampMs;
      if (ageMs <= 90 * DAY_MS) meetingsLast90Days += 1;
      if (ageMs <= 180 * DAY_MS) meetingsLast180Days += 1;
      if (ageMs <= 365 * DAY_MS) meetingsLast365Days += 1;
      if (record.eventFamily === currentEventFamily) meetingsSameEventFamily += 1;
      if (currentEventRegion !== "unknown" && record.eventRegion === currentEventRegion) meetingsSameEventRegion += 1;
    }

    const mostRecent = records[records.length - 1];

    return {
      priorMeetingCount: records.length,
      teamAWins,
      teamBWins,
      teamAWinRate: records.length > 0 ? teamAWins / records.length : 0.5,
      priorMapDifferential: mapDifferential,
      meetingsLast90Days,
      meetingsLast180Days,
      meetingsLast365Days,
      mostRecentMeetingWinnerProviderId: mostRecent?.winnerTeamId ?? "unknown",
      meetingsSameEventFamily,
      meetingsSameEventRegion,
    };
  }

  /** Records a completed meeting. Must only be called after every row in the current timestamp group has been snapshotted. */
  recordResult(input: RecordH2HInput): void {
    const key = pairKey(input.teamAId, input.teamBId);
    const existing = this.recordsByPair.get(key) ?? [];
    existing.push({
      timestampMs: input.timestampMs,
      recordedTeamAId: input.teamAId,
      recordedTeamBId: input.teamBId,
      winnerTeamId: input.winnerTeamId,
      mapsWonByRecordedTeamA: input.mapsWonByTeamA,
      mapsWonByRecordedTeamB: input.mapsWonByTeamB,
      eventFamily: input.eventFamily,
      eventRegion: input.eventRegion,
    });
    this.recordsByPair.set(key, existing);
  }
}
