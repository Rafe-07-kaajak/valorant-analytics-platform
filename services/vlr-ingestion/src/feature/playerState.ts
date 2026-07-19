/**
 * Player-experience state — TASK-044 requirement 12. Tracks each VLR
 * player ID's career appearance history strictly from observed roster
 * snapshots (never inferring membership beyond match evidence, consistent
 * with `quality/rosterQuality.ts`). All read methods only ever see
 * appearances recorded by `recordAppearance` calls made for strictly
 * earlier matches — the state engine guarantees appearances for the
 * current match/group are recorded only after every row in the group has
 * already read this state.
 */
export interface PlayerAppearanceRecord {
  readonly matchInternalId: string;
  readonly timestampMs: number;
  readonly teamInternalId: string;
  readonly won: boolean;
  readonly isInternational: boolean;
  readonly isMastersOrChampions: boolean;
}

interface PlayerRecord {
  appearances: PlayerAppearanceRecord[];
}

export class PlayerRegistry {
  private readonly players = new Map<string, PlayerRecord>();

  private getOrCreate(playerId: string): PlayerRecord {
    let record = this.players.get(playerId);
    if (!record) {
      record = { appearances: [] };
      this.players.set(playerId, record);
    }
    return record;
  }

  hasAppeared(playerId: string): boolean {
    return (this.players.get(playerId)?.appearances.length ?? 0) > 0;
  }

  priorAppearanceCount(playerId: string): number {
    return this.players.get(playerId)?.appearances.length ?? 0;
  }

  priorWinCount(playerId: string): number {
    return this.players.get(playerId)?.appearances.filter((a) => a.won).length ?? 0;
  }

  priorAppearancesSince(playerId: string, sinceMs: number): number {
    return this.players.get(playerId)?.appearances.filter((a) => a.timestampMs >= sinceMs).length ?? 0;
  }

  priorInternationalAppearanceCount(playerId: string): number {
    return this.players.get(playerId)?.appearances.filter((a) => a.isInternational).length ?? 0;
  }

  priorMastersChampionsAppearanceCount(playerId: string): number {
    return this.players.get(playerId)?.appearances.filter((a) => a.isMastersOrChampions).length ?? 0;
  }

  /** Records one player's appearance in a completed match. Must only be called after every feature row in the current timestamp group has already been emitted. */
  recordAppearance(playerId: string, record: PlayerAppearanceRecord): void {
    this.getOrCreate(playerId).appearances.push(record);
  }
}
