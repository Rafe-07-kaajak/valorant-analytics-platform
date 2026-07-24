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
  verifiedAt: string = "2026-07-18",
): VlrTeamMappingEntry {
  const sourceUrl = `https://www.vlr.gg/team/${vlrTeamId}/${slug}`;
  return {
    vlrTeamId,
    internalTeamId,
    reason,
    status: "verified",
    confidence: "authoritative",
    verifiedAt,
    sourceUrl,
    evidence: [{ description: reason, sourceUrl, observedAt: verifiedAt }],
  };
}

/**
 * Second-pass equivalent of `verifiedEntry`, defaulting `verifiedAt` to this
 * pass's date (2026-07-23) instead of the original TASK-042 date, so newly
 * added entries don't misreport when they were actually verified.
 */
function verifiedEntry2(vlrTeamId: string, internalTeamId: VctTeamId, slug: string, reason: string): VlrTeamMappingEntry {
  return verifiedEntry(vlrTeamId, internalTeamId, slug, reason, "2026-07-23");
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

  // Second verification pass (2026-07-23), covering the 22 roster teams
  // discovered unmapped in the real 432-match curated dataset (found by
  // display name in curated/matches.json, cross-referenced against
  // @repo/prediction-engine's 32-team directory). Each id below was
  // confirmed by directly fetching its live vlr.gg team page and matching
  // the page's own displayed team name/tag against the roster entry.
  verifiedEntry2("11058", "g2-esports", "g2-esports", "Verified via live fetch of /team/11058/g2-esports (2026-07-23) — page displays 'G2 Esports' / 'G2'."),
  verifiedEntry2("12685", "trace-esports", "trace-esports", "Verified via live fetch of /team/12685/trace-esports (2026-07-23) — page displays 'Trace Esports' / 'TE'."),
  verifiedEntry2("1120", "edward-gaming", "edward-gaming", "Verified via live fetch of /team/1120/edward-gaming (2026-07-23) — page displays 'EDward Gaming' / 'EDG'."),
  verifiedEntry2("474", "team-liquid", "team-liquid", "Verified via live fetch of /team/474/team-liquid (2026-07-23) — page displays 'Team Liquid' / 'TL'."),
  verifiedEntry2("14", "t1", "t1", "Verified via live fetch of /team/14/t1 (2026-07-23) — page displays 'T1' / '@T1'."),
  verifiedEntry2("8185", "kiwoom-drx", "kiwoom-drx", "Verified via live fetch of /team/8185/kiwoom-drx (2026-07-23) — page displays 'KIWOOM DRX' / 'KRX'."),
  verifiedEntry2("7386", "mibr", "mibr", "Verified via live fetch of /team/7386/mibr (2026-07-23) — page displays 'MIBR'."),
  verifiedEntry2("878", "rex-regum-qeon", "rex-regum-qeon", "Verified via live fetch of /team/878/rex-regum-qeon (2026-07-23) — page displays 'Rex Regum Qeon' / 'RRQ'."),
  verifiedEntry2("2593", "fnatic", "fnatic", "Verified via live fetch of /team/2593/fnatic (2026-07-23) — page displays 'FNATIC' / 'FNC'."),
  verifiedEntry2("11981", "dragon-ranger-gaming", "dragon-ranger-gaming", "Verified via live fetch of /team/11981/dragon-ranger-gaming (2026-07-23) — page displays 'Dragon Ranger Gaming' / 'DRG'."),
  verifiedEntry2("1184", "fut-esports", "fut-esports", "Verified via live fetch of /team/1184/fut-esports (2026-07-23) — page displays 'FUT Esports' / 'FUT'."),
  verifiedEntry2("12694", "gentle-mates", "gentle-mates", "Verified via live fetch of /team/12694/gentle-mates (2026-07-23) — page displays 'Gentle Mates' / 'M8'."),
  verifiedEntry2("11060", "nongshim-redforce", "nongshim-redforce", "Verified via live fetch of /team/11060/nongshim-redforce (2026-07-23) — page displays 'Nongshim RedForce' / 'NS'."),
  verifiedEntry2("4050", "full-sense", "full-sense", "Verified via live fetch of /team/4050/full-sense (2026-07-23) — page displays 'FULL SENSE' / 'FS'."),
  verifiedEntry2("278", "detonation-focusme", "detonation-focusme", "Verified via live fetch of /team/278/detonation-focusme (2026-07-23) — page displays 'DetonatioN FocusMe' / 'DFM'."),
  verifiedEntry2("6961", "loud", "loud", "Verified via live fetch of /team/6961/loud (2026-07-23) — page displays 'LOUD'."),
  verifiedEntry2("2406", "furia", "furia", "Verified via live fetch of /team/2406/furia (2026-07-23) — page displays 'FURIA' / 'FUR'."),
  verifiedEntry2("2359", "leviatan", "leviatan", "Verified via live fetch of /team/2359/leviatan (2026-07-23) — page displays 'LEVIATÁN' / 'LEV'."),
  verifiedEntry2("13576", "jdg-esports", "jdg-esports", "Verified via live fetch of /team/13576/jdg-esports (2026-07-23) — page displays 'JDG Esports' / 'JDG'."),
  verifiedEntry2("14137", "titan-esports-club", "titan-esports-club", "Verified via live fetch of /team/14137/titan-esports-club (2026-07-23) — page displays 'Titan Esports Club' / 'TEC'."),
  verifiedEntry2("731", "tyloo", "tyloo", "Verified via live fetch of /team/731/tyloo (2026-07-23) — page displays 'TYLOO' / 'TYL'."),
  verifiedEntry2("6392", "eternal-fire", "eternal-fire", "Verified via live fetch of /team/6392/eternal-fire (2026-07-23) — page displays 'Eternal Fire' / 'EF'."),
];
