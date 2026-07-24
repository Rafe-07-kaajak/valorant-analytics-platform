import { parseVlrSourceReference } from "../identity/deterministicId";
import type { VlrTeamMappingEntry } from "../identity/teamMapping";
import type { NormalizedMapResult, NormalizedMatch, NormalizedRosterSnapshot } from "../normalize/normalizedSchemas";

/**
 * Identity resolution (`resolveTeamIdentity`) runs once, at normalize time
 * (`normalizeMatch.ts`), and an already-`completed` match is never
 * re-normalized on a later backfill run (`backfillRunner.ts`'s
 * `processMatch()` skips it outright). A team newly added to
 * `INITIAL_TEAM_MAPPING_REGISTRY` therefore does NOT retroactively change
 * any already-normalized match's `teamAId`/`teamBId` — those stay frozen as
 * the deterministic `vlr:team:<id>` fallback forever unless something
 * re-derives them.
 *
 * This module is that "something," applied at curate time (after
 * normalization, before export) rather than by re-normalizing anything: it
 * only ever replaces a still-unmapped `vlr:team:<id>` string with the
 * canonical id the (now more complete) registry resolves it to. A team id
 * that's already a canonical slug, or that still has no mapping, passes
 * through completely unchanged. Nothing on disk in `normalized/` is read or
 * written by this module — it only transforms already-loaded in-memory
 * `NormalizedMatch` objects before curated export.
 */

function remapTeamId(internalId: string, mapping: ReadonlyMap<string, VlrTeamMappingEntry>): string {
  const parsed = parseVlrSourceReference(internalId);
  if (!parsed || parsed.entityType !== "team") return internalId;

  const entry = mapping.get(parsed.externalId);
  return entry ? entry.internalTeamId : internalId;
}

function remapMapResult(map: NormalizedMapResult, mapping: ReadonlyMap<string, VlrTeamMappingEntry>): NormalizedMapResult {
  if (!map.winnerInternalTeamId) return map;
  return { ...map, winnerInternalTeamId: remapTeamId(map.winnerInternalTeamId, mapping) };
}

function remapRosterSnapshot(
  snapshot: NormalizedRosterSnapshot,
  mapping: ReadonlyMap<string, VlrTeamMappingEntry>,
): NormalizedRosterSnapshot {
  return { ...snapshot, teamInternalId: remapTeamId(snapshot.teamInternalId, mapping) };
}

/**
 * Remaps every team-identity field on a single normalized match
 * (`teamAId`, `teamBId`, `winnerId`, each map's `winnerInternalTeamId`, each
 * roster snapshot's `teamInternalId`) against the current team mapping
 * registry. Purely additive over already-curated fields — display-name
 * enrichment (`enrichMatchDisplayMetadata`) must run after this, not before,
 * so a newly-mapped team's display name resolution sees its corrected id.
 */
export function remapUnmappedTeamIdentities(
  match: NormalizedMatch,
  mapping: ReadonlyMap<string, VlrTeamMappingEntry>,
): NormalizedMatch {
  return {
    ...match,
    teamAId: remapTeamId(match.teamAId, mapping),
    teamBId: remapTeamId(match.teamBId, mapping),
    winnerId: match.winnerId ? remapTeamId(match.winnerId, mapping) : match.winnerId,
    maps: match.maps.map((map) => remapMapResult(map, mapping)),
    rosterSnapshots: match.rosterSnapshots?.map((snapshot) => remapRosterSnapshot(snapshot, mapping)),
  };
}
