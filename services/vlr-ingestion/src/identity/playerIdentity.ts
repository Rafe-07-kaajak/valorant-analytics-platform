import { deterministicInternalId } from "./deterministicId";

/**
 * Provider-neutral player identity — TASK-043 requirement 7. Unlike teams
 * (which map onto an existing internal `VctTeamId` registry), no internal
 * player registry exists anywhere in this repository yet — every canonical
 * player identity is simply its deterministic provider reference
 * (`vlr:player:<id>`), matching `identity/deterministicId.ts`'s existing
 * policy and `normalize/normalizeMatch.ts`'s current roster-snapshot
 * behavior (never touched here). The VLR player ID is authoritative; a
 * handle is a display attribute of that ID, never identity by itself —
 * the same handle appearing under two different VLR IDs must remain two
 * distinct players unless explicit evidence proves otherwise (requirement
 * 7's "same handle across different VLR IDs must remain distinct").
 *
 * The current dataset does not capture player handles at all —
 * `matchDetailParser.ts`'s `parseRosters` extracts only the numeric VLR
 * player ID from each roster row's profile link, never the displayed
 * handle text (see docs/31's "Known limitations"). The handle-based
 * functions below are therefore fixture/future-data-testable, but running
 * them against today's stored roster snapshots alone will not surface any
 * handle collisions — that is an honest limitation, not a bug in this
 * module.
 */
export interface ProviderPlayerIdentity {
  readonly vlrPlayerId: string;
  readonly handle?: string;
  readonly realName?: string;
  readonly country?: string;
}

export interface CanonicalPlayerIdentity {
  readonly internalId: string;
  readonly vlrPlayerId: string;
}

export function resolvePlayerIdentity(vlrPlayerId: string): CanonicalPlayerIdentity {
  return { internalId: deterministicInternalId("player", vlrPlayerId), vlrPlayerId };
}

export interface PlayerHandleObservation {
  readonly vlrPlayerId: string;
  readonly handle: string;
  readonly observedAt: string;
  readonly sourceReference?: string;
}

export interface PlayerAlias {
  readonly vlrPlayerId: string;
  readonly handle: string;
  readonly firstSeen: string;
  readonly lastSeen: string;
}

/** Chronological, deduplicated handle history per VLR player ID — a handle change for one ID forms a trail, never overwrites. */
export function buildPlayerHandleHistory(observations: readonly PlayerHandleObservation[]): ReadonlyMap<string, readonly PlayerAlias[]> {
  const byPlayerId = new Map<string, PlayerHandleObservation[]>();
  for (const observation of observations) {
    const bucket = byPlayerId.get(observation.vlrPlayerId);
    if (bucket) bucket.push(observation);
    else byPlayerId.set(observation.vlrPlayerId, [observation]);
  }

  const history = new Map<string, PlayerAlias[]>();
  for (const [vlrPlayerId, playerObservations] of byPlayerId) {
    const byHandle = new Map<string, PlayerHandleObservation[]>();
    for (const observation of playerObservations) {
      const bucket = byHandle.get(observation.handle);
      if (bucket) bucket.push(observation);
      else byHandle.set(observation.handle, [observation]);
    }
    const aliases: PlayerAlias[] = [];
    for (const [handle, group] of byHandle) {
      const sorted = [...group].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
      aliases.push({ vlrPlayerId, handle, firstSeen: sorted[0]!.observedAt, lastSeen: sorted[sorted.length - 1]!.observedAt });
    }
    aliases.sort((a, b) => a.firstSeen.localeCompare(b.firstSeen));
    history.set(vlrPlayerId, aliases);
  }
  return history;
}

export interface PlayerIdentityConflict {
  readonly handle: string;
  readonly conflictingVlrPlayerIds: readonly string[];
}

/**
 * Detects the same handle text observed under more than one distinct VLR
 * player ID — a conflict surfaced for review, never auto-merged
 * (requirement 7: "same handle across different VLR IDs must remain
 * distinct unless explicit evidence proves otherwise").
 */
export function detectDuplicateHandles(observations: readonly PlayerHandleObservation[]): readonly PlayerIdentityConflict[] {
  const idsByHandle = new Map<string, Set<string>>();
  for (const observation of observations) {
    const bucket = idsByHandle.get(observation.handle);
    if (bucket) bucket.add(observation.vlrPlayerId);
    else idsByHandle.set(observation.handle, new Set([observation.vlrPlayerId]));
  }
  const conflicts: PlayerIdentityConflict[] = [];
  for (const [handle, ids] of idsByHandle) {
    if (ids.size > 1) conflicts.push({ handle, conflictingVlrPlayerIds: [...ids].sort() });
  }
  return conflicts;
}

/** A missing player ID (an empty/undefined roster slot) must be flagged, never silently dropped from a roster count. */
export function isMissingPlayerId(vlrPlayerId: string | undefined | null): boolean {
  return !vlrPlayerId || vlrPlayerId.trim().length === 0;
}
