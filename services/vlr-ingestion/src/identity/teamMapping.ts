import { VCT_TEAM_IDENTITIES } from "@repo/prediction-engine";
import type { VctTeamId } from "@repo/prediction-engine";
import { deterministicInternalId } from "./deterministicId";

/**
 * Team identity mapping — see docs/29-vlr-data-ingestion-foundation.md
 * ("Mapping Policy"), docs/31-vlr-identity-and-data-quality.md, TASK-041
 * requirement 9, and TASK-043's identity-resolution hardening.
 *
 * Maps a VLR external team ID to one of the existing 32 internal
 * `VctTeamId`s that already power the synthetic profile layer
 * (`@repo/prediction-engine`). Exact external-ID mapping is authoritative;
 * display-name aliases exist purely for human diagnostics and must never
 * silently create a mapping — see `findAliasCandidates`, which only
 * *suggests*, never resolves.
 */
export type TeamMappingStatus = "verified" | "provisional" | "conflicted" | "retired";

/** A single piece of evidence supporting a mapping's status — TASK-043 requirement 3. */
export interface TeamIdentityEvidence {
  readonly description: string;
  readonly sourceUrl?: string;
  readonly observedAt?: string;
}

export interface VlrTeamMappingEntry {
  readonly vlrTeamId: string;
  readonly internalTeamId: VctTeamId;
  /** Display-name aliases seen for this team, for diagnostics only. */
  readonly aliases?: readonly string[];
  readonly reason: string;
  /** Defaults to "verified" when omitted — every pre-TASK-043 entry was already a manually-verified exact-ID mapping. */
  readonly status?: TeamMappingStatus;
  /** Defaults to "authoritative" when omitted, matching pre-TASK-043 entries' verification standard. */
  readonly confidence?: "authoritative" | "high" | "low";
  readonly evidence?: readonly TeamIdentityEvidence[];
  readonly verifiedAt?: string;
  readonly sourceUrl?: string;
  readonly notes?: string;
}

/** `entry.status`, defaulted for pre-TASK-043 entries that never set it — see `VlrTeamMappingEntry`'s doc comment. */
export function effectiveMappingStatus(entry: VlrTeamMappingEntry): TeamMappingStatus {
  return entry.status ?? "verified";
}

export function effectiveMappingConfidence(entry: VlrTeamMappingEntry): "authoritative" | "high" | "low" {
  return entry.confidence ?? "authoritative";
}

export interface TeamMappingConflict {
  readonly vlrTeamId: string;
  readonly conflicting: readonly VlrTeamMappingEntry[];
}

export interface TeamMappingValidationResult {
  readonly valid: boolean;
  readonly conflicts: readonly TeamMappingConflict[];
  readonly invalidEntries: readonly { entry: VlrTeamMappingEntry; reasons: readonly string[] }[];
}

const KNOWN_INTERNAL_TEAM_IDS: ReadonlySet<VctTeamId> = new Set(VCT_TEAM_IDENTITIES.map((identity) => identity.id));

function validateEntry(entry: VlrTeamMappingEntry): string[] {
  const reasons: string[] = [];
  if (!entry.vlrTeamId || entry.vlrTeamId.trim().length === 0) {
    reasons.push("vlrTeamId must be a non-empty string.");
  }
  if (!KNOWN_INTERNAL_TEAM_IDS.has(entry.internalTeamId)) {
    reasons.push(`internalTeamId "${entry.internalTeamId}" is not one of the known 32 VctTeamId values.`);
  }
  if (!entry.reason || entry.reason.trim().length === 0) {
    reasons.push("reason must document how this mapping was verified.");
  }
  return reasons;
}

/** Validates a team mapping registry, detecting conflicting entries for the same VLR team ID. */
export function validateTeamMappingRegistry(entries: readonly VlrTeamMappingEntry[]): TeamMappingValidationResult {
  const invalidEntries: { entry: VlrTeamMappingEntry; reasons: readonly string[] }[] = [];
  for (const entry of entries) {
    const reasons = validateEntry(entry);
    if (reasons.length > 0) invalidEntries.push({ entry, reasons });
  }

  const byVlrId = new Map<string, VlrTeamMappingEntry[]>();
  for (const entry of entries) {
    const bucket = byVlrId.get(entry.vlrTeamId);
    if (bucket) bucket.push(entry);
    else byVlrId.set(entry.vlrTeamId, [entry]);
  }

  const conflicts: TeamMappingConflict[] = [];
  for (const [vlrTeamId, group] of byVlrId) {
    const distinctTargets = new Set(group.map((entry) => entry.internalTeamId));
    if (distinctTargets.size > 1) conflicts.push({ vlrTeamId, conflicting: group });
  }

  return { valid: invalidEntries.length === 0 && conflicts.length === 0, conflicts, invalidEntries };
}

export function buildTeamMappingLookup(entries: readonly VlrTeamMappingEntry[]): ReadonlyMap<string, VlrTeamMappingEntry> {
  const lookup = new Map<string, VlrTeamMappingEntry>();
  for (const entry of entries) lookup.set(entry.vlrTeamId, entry);
  return lookup;
}

export interface ResolvedTeamIdentity {
  readonly internalId: string;
  readonly mapped: boolean;
}

/**
 * Resolves a VLR team ID to an internal identity. A mapped team returns its
 * verified `VctTeamId`; an unmapped team still returns a valid, stable,
 * deterministic external identity (`vlr:team:<id>`) rather than being
 * rejected — see requirement 9: "unmapped teams must remain valid
 * normalized external entities."
 */
export function resolveTeamIdentity(vlrTeamId: string, mapping: ReadonlyMap<string, VlrTeamMappingEntry>): ResolvedTeamIdentity {
  const entry = mapping.get(vlrTeamId);
  if (entry) return { internalId: entry.internalTeamId, mapped: true };
  return { internalId: deterministicInternalId("team", vlrTeamId), mapped: false };
}

/**
 * Suggests possible internal teams by alias match, for a human to review —
 * this NEVER resolves a mapping automatically. See requirement 9: "aliases
 * may assist diagnostics but must not silently create mappings."
 */
export function findAliasCandidates(displayName: string, entries: readonly VlrTeamMappingEntry[]): readonly VlrTeamMappingEntry[] {
  const normalized = displayName.trim().toLowerCase();
  return entries.filter((entry) => entry.aliases?.some((alias) => alias.trim().toLowerCase() === normalized));
}

/**
 * Initial team mapping registry. Left empty at TASK-041 foundation time
 * (fixtures were synthetic — no verified real VLR ID was available).
 *
 * TASK-042 verified these 10 exact-ID mappings directly from a live VLR.gg
 * match page (https://www.vlr.gg/684613/xi-lai-gaming-vs-nrg-valorant-masters-london-2026-r1
 * and its linked team pages, fetched 2026-07-18 during the live-markup
 * verification session — raw HTML held only in the gitignored
 * services/vlr-ingestion/.local/raw-inspect/ scratch directory, never
 * committed). Each `/team/<id>/<slug>` link's display name was matched
 * exactly against `@repo/prediction-engine`'s 32-team directory; unmatched
 * teams seen on that page (e.g. Karmine Corp, Team Secret) are correctly
 * left unmapped — see requirement 10 ("never map only by name").
 * Remaining unmapped supported teams are discovered and added the same way
 * as the real backfill encounters their matches — see docs/30 for the
 * running "unmapped teams" report.
 */
function verifiedEntry(
  vlrTeamId: string,
  internalTeamId: VctTeamId,
  slug: string,
  reason: string,
): VlrTeamMappingEntry {
  const sourceUrl = `https://www.vlr.gg/team/${vlrTeamId}/${slug}`;
  return {
    vlrTeamId,
    internalTeamId,
    reason,
    status: "verified",
    confidence: "authoritative",
    verifiedAt: "2026-07-18",
    sourceUrl,
    evidence: [{ description: reason, sourceUrl, observedAt: "2026-07-18" }],
  };
}

export const INITIAL_TEAM_MAPPING_REGISTRY: readonly VlrTeamMappingEntry[] = [
  verifiedEntry("1034", "nrg", "nrg", "Verified via /team/1034/nrg link on a live match page (2026-07-18)."),
  verifiedEntry("120", "100-thieves", "100-thieves", "Verified via /team/120/100-thieves link on a live match page (2026-07-18)."),
  verifiedEntry("2355", "kru-esports", "kr-esports", "Verified via /team/2355/kr-esports link (display name 'KRÜ Esports') on a live match page (2026-07-18)."),
  verifiedEntry("1001", "team-heretics", "team-heretics", "Verified via /team/1001/team-heretics link on a live match page (2026-07-18)."),
  verifiedEntry("2059", "team-vitality", "team-vitality", "Verified via /team/2059/team-vitality link on a live match page (2026-07-18)."),
  verifiedEntry("397", "bbl-esports", "bbl-esports", "Verified via /team/397/bbl-esports link on a live match page (2026-07-18)."),
  verifiedEntry("624", "paper-rex", "paper-rex", "Verified via /team/624/paper-rex link on a live match page (2026-07-18)."),
  verifiedEntry("918", "global-esports", "global-esports", "Verified via /team/918/global-esports link on a live match page (2026-07-18)."),
  verifiedEntry("1119", "all-gamers", "all-gamers", "Verified via /team/1119/all-gamers link on a live match page (2026-07-18)."),
  verifiedEntry("13581", "xi-lai-gaming", "xi-lai-gaming", "Verified via /team/13581/xi-lai-gaming link — the match page's own team A — fetched live (2026-07-18)."),
];
