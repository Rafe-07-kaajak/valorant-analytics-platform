import { VCT_TEAM_IDENTITIES } from "@repo/prediction-engine";
import { parseVlrSourceReference } from "./deterministicId";
import { validateTeamMappingRegistry } from "./teamMapping";
import type { VlrTeamMappingEntry } from "./teamMapping";
import type { NormalizedEvent, NormalizedMatch } from "../normalize/normalizedSchemas";

/**
 * Baseline identity audit — TASK-043 requirement 2 ("Teams" and "Players"
 * sections). Read-only: derives every figure directly from already-
 * persisted normalized records, never from live requests. See
 * docs/31-vlr-identity-and-data-quality.md's "Known limitations" for why
 * team display names and player handles are not populated here — neither
 * is captured anywhere in the current normalized schema (see
 * `normalize/normalizeMatch.ts` / `matchDetailParser.ts`'s `parseRosters`).
 */
export interface TeamAuditEntry {
  readonly teamInternalId: string;
  readonly mapped: boolean;
  readonly vlrTeamId?: string;
  readonly matchAppearances: number;
  readonly eventAppearances: number;
  readonly firstSeen?: string;
  readonly lastSeen?: string;
}

export interface TeamAudit {
  readonly uniqueVlrTeamIds: number;
  readonly uniqueInternalTeamIds: number;
  readonly mappedTeamCount: number;
  readonly unmappedTeamCount: number;
  readonly duplicateInternalMappingCount: number;
  readonly entries: readonly TeamAuditEntry[];
  readonly currentSupportedTeamCandidates: readonly string[];
  readonly currentSupportedTeamsMapped: readonly string[];
  readonly currentSupportedTeamsUnresolved: readonly string[];
}

export function buildTeamAudit(matches: readonly NormalizedMatch[], teamMapping: readonly VlrTeamMappingEntry[]): TeamAudit {
  const validation = validateTeamMappingRegistry(teamMapping);
  const mappedInternalIds = new Set(teamMapping.map((entry) => entry.internalTeamId));

  interface Accumulator {
    matchAppearances: number;
    eventIds: Set<string>;
    firstSeen?: string;
    lastSeen?: string;
  }
  const byTeam = new Map<string, Accumulator>();

  const touch = (teamInternalId: string, eventId: string, scheduledAtIso: string | null) => {
    let acc = byTeam.get(teamInternalId);
    if (!acc) {
      acc = { matchAppearances: 0, eventIds: new Set() };
      byTeam.set(teamInternalId, acc);
    }
    acc.matchAppearances += 1;
    acc.eventIds.add(eventId);
    if (scheduledAtIso) {
      if (!acc.firstSeen || scheduledAtIso < acc.firstSeen) acc.firstSeen = scheduledAtIso;
      if (!acc.lastSeen || scheduledAtIso > acc.lastSeen) acc.lastSeen = scheduledAtIso;
    }
  };

  for (const match of matches) {
    touch(match.teamAId, match.eventId, match.scheduledAt.iso);
    touch(match.teamBId, match.eventId, match.scheduledAt.iso);
  }

  const entries: TeamAuditEntry[] = [...byTeam.entries()].map(([teamInternalId, acc]) => {
    const mapped = !teamInternalId.startsWith("vlr:team:");
    const parsed = teamInternalId.startsWith("vlr:team:") ? parseVlrSourceReference(teamInternalId) : undefined;
    return {
      teamInternalId,
      mapped,
      vlrTeamId: parsed?.externalId,
      matchAppearances: acc.matchAppearances,
      eventAppearances: acc.eventIds.size,
      firstSeen: acc.firstSeen,
      lastSeen: acc.lastSeen,
    };
  });
  entries.sort((a, b) => a.teamInternalId.localeCompare(b.teamInternalId));

  const mappedEntries = entries.filter((e) => e.mapped);
  const unmappedEntries = entries.filter((e) => !e.mapped);
  const supportedTeamIds = VCT_TEAM_IDENTITIES.map((t) => t.id);
  const supportedMapped = supportedTeamIds.filter((id) => mappedInternalIds.has(id));
  const supportedUnresolved = supportedTeamIds.filter((id) => !mappedInternalIds.has(id));

  return {
    uniqueVlrTeamIds: unmappedEntries.length + mappedEntries.filter((e) => e.vlrTeamId).length,
    uniqueInternalTeamIds: entries.length,
    mappedTeamCount: mappedEntries.length,
    unmappedTeamCount: unmappedEntries.length,
    duplicateInternalMappingCount: validation.conflicts.length,
    entries,
    currentSupportedTeamCandidates: supportedTeamIds,
    currentSupportedTeamsMapped: supportedMapped,
    currentSupportedTeamsUnresolved: supportedUnresolved,
  };
}

export interface PlayerAuditEntry {
  readonly playerInternalId: string;
  readonly rosterAppearances: number;
  readonly teamsRepresented: readonly string[];
  readonly firstSeen?: string;
  readonly lastSeen?: string;
}

export interface PlayerAudit {
  readonly uniquePlayerIds: number;
  readonly rosterAppearanceCount: number;
  readonly incompleteRosterSnapshotCount: number;
  readonly missingPlayerIdCount: number;
  readonly entries: readonly PlayerAuditEntry[];
  /** Handles are not captured anywhere in the current normalized schema — see this module's doc comment. Always 0/empty; not a bug. */
  readonly uniqueHandlesDerivable: false;
}

export function buildPlayerAudit(matches: readonly NormalizedMatch[]): PlayerAudit {
  interface Accumulator {
    rosterAppearances: number;
    teams: Set<string>;
    firstSeen?: string;
    lastSeen?: string;
  }
  const byPlayer = new Map<string, Accumulator>();
  let incompleteRosterSnapshotCount = 0;

  for (const match of matches) {
    const rosters = match.rosterSnapshots ?? [];
    if (rosters.length < 2 || rosters.some((r) => r.playerInternalIds.length < 5)) incompleteRosterSnapshotCount += 1;

    for (const roster of rosters) {
      for (const playerInternalId of roster.playerInternalIds) {
        let acc = byPlayer.get(playerInternalId);
        if (!acc) {
          acc = { rosterAppearances: 0, teams: new Set() };
          byPlayer.set(playerInternalId, acc);
        }
        acc.rosterAppearances += 1;
        acc.teams.add(roster.teamInternalId);
        if (!acc.firstSeen || roster.asOf < acc.firstSeen) acc.firstSeen = roster.asOf;
        if (!acc.lastSeen || roster.asOf > acc.lastSeen) acc.lastSeen = roster.asOf;
      }
    }
  }

  const entries: PlayerAuditEntry[] = [...byPlayer.entries()]
    .map(([playerInternalId, acc]) => ({ playerInternalId, rosterAppearances: acc.rosterAppearances, teamsRepresented: [...acc.teams].sort(), firstSeen: acc.firstSeen, lastSeen: acc.lastSeen }))
    .sort((a, b) => a.playerInternalId.localeCompare(b.playerInternalId));

  return {
    uniquePlayerIds: entries.length,
    rosterAppearanceCount: entries.reduce((sum, e) => sum + e.rosterAppearances, 0),
    incompleteRosterSnapshotCount,
    missingPlayerIdCount: 0,
    entries,
    uniqueHandlesDerivable: false,
  };
}

export interface EventAuditEntry {
  readonly eventInternalId: string;
  readonly name: string;
  readonly family: string;
  readonly stage?: string;
  readonly season?: string;
  readonly region?: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly matchCount: number;
}

export interface EventAudit {
  readonly uniqueEventIds: number;
  readonly duplicateEventRecordCount: number;
  readonly entries: readonly EventAuditEntry[];
}

export function buildEventAudit(events: readonly NormalizedEvent[], matches: readonly NormalizedMatch[]): EventAudit {
  const matchCountByEvent = new Map<string, number>();
  for (const match of matches) matchCountByEvent.set(match.eventId, (matchCountByEvent.get(match.eventId) ?? 0) + 1);

  const seenIds = new Set<string>();
  let duplicateEventRecordCount = 0;
  const entries: EventAuditEntry[] = [];
  for (const event of events) {
    if (seenIds.has(event.internalId)) duplicateEventRecordCount += 1;
    seenIds.add(event.internalId);
    entries.push({
      eventInternalId: event.internalId,
      name: event.name,
      family: event.eventFamily,
      stage: event.stage,
      season: event.season,
      region: event.region,
      startDate: event.startDate.iso ?? undefined,
      endDate: event.endDate.iso ?? undefined,
      matchCount: matchCountByEvent.get(event.internalId) ?? 0,
    });
  }
  entries.sort((a, b) => a.eventInternalId.localeCompare(b.eventInternalId));

  return { uniqueEventIds: seenIds.size, duplicateEventRecordCount, entries };
}
