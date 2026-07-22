import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";
import { resolveSafePath } from "../persistence/pathSafety";
import { contentHash } from "../normalize/contentHash";
import type { NormalizedEvent, NormalizedMatch } from "../normalize/normalizedSchemas";
import type { VlrTeamMappingEntry } from "../identity/teamMapping";
import type { TeamAlias } from "../identity/teamAliasRegistry";
import { buildPlayerAudit, buildTeamAudit } from "../identity/identityAudit";
import { buildPlayerTeamAppearanceTimeline } from "../quality/rosterQuality";
import type { QualityIssue } from "../quality/qualityIssue";
import type { QuarantineRecord } from "../quality/quarantine";
import type { ReconciliationCategory } from "../reconciliation/reconciliationTypes";
import type { MatchManifestEntry } from "../discovery/matchManifest";
import { computeCuratedDatasetVersion, computeIdentityMappingVersion } from "./curatedVersion";

/**
 * A curated match record, enriched with human-readable display metadata —
 * TASK-057 (Historical Replay name resolution). `teamAId`/`teamBId` remain
 * the canonical internal identity (a verified `VctTeamId` slug, or a stable
 * `vlr:team:<id>` for an unmapped team) and are never replaced; the display
 * fields below are presentation-only, sourced from VLR's own match-listing
 * scrape (`MatchManifestEntry`, already fetched during discovery — no new
 * network access), so a team's display name naturally reflects whatever name
 * VLR showed for that specific match at that point in time, rather than a
 * single present-day override.
 */
export interface CuratedMatch extends NormalizedMatch {
  readonly teamADisplayName: string;
  readonly teamBDisplayName: string;
  /** Per-match round/bracket text (e.g. "Grand Final Playoffs"), falling back to the event's own `stage` when discovery has none — never the ML `eventStage` feature, which stays governed by docs/32's "Region/Team Metadata Policy" and must not change meaning here. */
  readonly matchStageDisplay: string;
}

const UNMAPPED_TEAM_ID_PREFIX = "vlr:team:";

/** Title-cases an internal team slug (e.g. `"paper-rex"` -> `"Paper Rex"`) — only ever used when discovery captured no raw name for a *mapped* team, which does not happen in the current dataset but keeps the fallback chain honest for future data. */
function titleCaseSlug(slug: string): string {
  return slug
    .split("-")
    .filter((part) => part.length > 0)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");
}

/** Resolves the best available human-readable team name — see `CuratedMatch` doc comment for the precedence rationale: (1) VLR's own raw name for this specific match, (2) a title-cased canonical slug for a mapped team with no raw name on record, (3) the stable `vlr:team:<id>` identifier itself, only when nothing readable exists at all. */
function resolveTeamDisplayName(internalTeamId: string, rawNameFromDiscovery: string | undefined): string {
  const trimmedRaw = rawNameFromDiscovery?.trim();
  if (trimmedRaw) return trimmedRaw;
  if (!internalTeamId.startsWith(UNMAPPED_TEAM_ID_PREFIX)) return titleCaseSlug(internalTeamId);
  return internalTeamId;
}

function resolveMatchStageDisplay(roundStageText: string | undefined, eventStage: string | undefined): string {
  const trimmedStage = roundStageText?.trim();
  if (trimmedStage) return trimmedStage;
  const trimmedEventStage = eventStage?.trim();
  if (trimmedEventStage) return trimmedEventStage;
  return "unknown";
}

function enrichMatchDisplayMetadata(match: NormalizedMatch, manifestByVlrMatchId: ReadonlyMap<string, MatchManifestEntry>, eventsByInternalId: ReadonlyMap<string, NormalizedEvent>): CuratedMatch {
  const manifestEntry = manifestByVlrMatchId.get(match.sourceReference.externalId);
  const event = eventsByInternalId.get(match.eventId);
  return {
    ...match,
    teamADisplayName: resolveTeamDisplayName(match.teamAId, manifestEntry?.teamANameRaw),
    teamBDisplayName: resolveTeamDisplayName(match.teamBId, manifestEntry?.teamBNameRaw),
    matchStageDisplay: resolveMatchStageDisplay(manifestEntry?.roundStageText, event?.stage),
  };
}

/**
 * Canonical clean-dataset export — TASK-043 requirement 18. Every output is
 * sorted and stably serialized so the same input always produces
 * byte-identical files (`pnpm ingest:vlr:curate` run twice in a row is a
 * true no-op on disk). Only current-approved, non-quarantined matches ever
 * appear in `matches.json`; stale/quarantined records are written to their
 * own separate files instead of being silently excluded from the dataset
 * altogether.
 */
export const CURATED_DIR_SEGMENTS = ["curated"] as const;

export interface CuratedExportInput {
  readonly matches: readonly NormalizedMatch[];
  readonly events: readonly NormalizedEvent[];
  readonly teamMapping: readonly VlrTeamMappingEntry[];
  readonly teamAliases: readonly TeamAlias[];
  readonly qualityIssues: readonly QualityIssue[];
  readonly quarantineRecords: readonly QuarantineRecord[];
  readonly matchCategoryByInternalId: ReadonlyMap<string, ReconciliationCategory>;
  readonly eventCategoryByInternalId: ReadonlyMap<string, ReconciliationCategory>;
  readonly sourceDatasetVersion: string;
  readonly generatedAt: string;
  /** TASK-057: already-persisted discovery data (match-list page scrape), joined in here only for display-name/stage enrichment — never a new network call. Optional so existing callers/tests that don't care about display metadata keep working unchanged. */
  readonly matchManifestEntries?: readonly MatchManifestEntry[];
}

export interface CuratedDatasetManifest {
  readonly curatedDatasetVersion: string;
  readonly schemaVersion: string;
  readonly parserVersion: string;
  readonly qualityRulesVersion: string;
  readonly identityMappingVersion: string;
  readonly sourceDatasetVersion: string;
  readonly generatedAt: string;
  readonly curatedMatchCount: number;
  readonly curatedEventCount: number;
  readonly quarantinedMatchCount: number;
  readonly eligibleMatchCount: number;
  readonly qualityIssueCount: number;
}

export interface CuratedDatasetFiles {
  readonly "teams.json": unknown;
  readonly "players.json": unknown;
  readonly "events.json": unknown;
  readonly "matches.json": unknown;
  readonly "roster-appearances.json": unknown;
  readonly "identity-mappings.json": unknown;
  readonly "quality-issues.json": unknown;
  readonly "quarantine.json": unknown;
  readonly "dataset-manifest.json": CuratedDatasetManifest;
}

const quarantinedIds = (records: readonly QuarantineRecord[]): ReadonlySet<string> => new Set(records.map((r) => r.internalId));

export function buildCuratedDataset(input: CuratedExportInput): CuratedDatasetFiles {
  const quarantined = quarantinedIds(input.quarantineRecords);
  const manifestByVlrMatchId = new Map((input.matchManifestEntries ?? []).map((entry) => [entry.vlrMatchId, entry]));
  const eventsByInternalId = new Map(input.events.map((event) => [event.internalId, event]));

  const curatedMatches = input.matches
    .filter((m) => input.matchCategoryByInternalId.get(m.internalId) === "current-approved" && !quarantined.has(m.internalId))
    .sort((a, b) => a.internalId.localeCompare(b.internalId))
    .map((match) => enrichMatchDisplayMetadata(match, manifestByVlrMatchId, eventsByInternalId));

  const curatedEvents = input.events
    .filter((e) => input.eventCategoryByInternalId.get(e.internalId) === "current-approved")
    .sort((a, b) => a.internalId.localeCompare(b.internalId));

  const teamAudit = buildTeamAudit(curatedMatches, input.teamMapping);
  const playerAudit = buildPlayerAudit(curatedMatches);
  const rosterAppearances = buildPlayerTeamAppearanceTimeline(curatedMatches);

  const identityMappingVersion = computeIdentityMappingVersion(input.teamMapping, input.teamAliases);
  const curatedMatchContentHashes = curatedMatches.map((m) => m.metadata.contentHash);
  const version = computeCuratedDatasetVersion({
    sourceDatasetVersion: input.sourceDatasetVersion,
    identityMappingVersion,
    curatedMatchInternalIds: curatedMatches.map((m) => m.internalId),
    curatedMatchContentHashes,
  });

  const eligibleMatchCount = curatedMatches.filter((m) => m.trainingEligibility.eligible).length;

  const openIssues = [...input.qualityIssues].sort((a, b) => a.entityId.localeCompare(b.entityId) || a.code.localeCompare(b.code));

  const manifest: CuratedDatasetManifest = {
    curatedDatasetVersion: version.curatedDatasetVersion,
    schemaVersion: version.schemaVersion,
    parserVersion: version.parserVersion,
    qualityRulesVersion: version.qualityRulesVersion,
    identityMappingVersion: version.identityMappingVersion,
    sourceDatasetVersion: version.sourceDatasetVersion,
    generatedAt: input.generatedAt,
    curatedMatchCount: curatedMatches.length,
    curatedEventCount: curatedEvents.length,
    quarantinedMatchCount: input.quarantineRecords.length,
    eligibleMatchCount,
    qualityIssueCount: input.qualityIssues.length,
  };

  return {
    "teams.json": teamAudit,
    "players.json": playerAudit,
    "events.json": curatedEvents,
    "matches.json": curatedMatches,
    "roster-appearances.json": rosterAppearances,
    "identity-mappings.json": { teamMapping: [...input.teamMapping].sort((a, b) => a.vlrTeamId.localeCompare(b.vlrTeamId)), teamAliases: [...input.teamAliases].sort((a, b) => a.alias.localeCompare(b.alias)) },
    "quality-issues.json": openIssues,
    "quarantine.json": [...input.quarantineRecords].sort((a, b) => a.internalId.localeCompare(b.internalId)),
    "dataset-manifest.json": manifest,
  };
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries.map(([key, val]) => [key, sortKeysDeep(val)]));
  }
  return value;
}

/** Stable, deterministic serialization: sorted object keys, 2-space indent — identical input always produces byte-identical output. */
export function stableStringify(value: unknown): string {
  return `${JSON.stringify(sortKeysDeep(value), null, 2)}\n`;
}

async function writeFileAtomic(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${randomBytes(6).toString("hex")}`;
  await writeFile(tempPath, content, "utf-8");
  await rename(tempPath, filePath);
}

/** Writes every curated file under `<dataDir>/curated/`. Returns the content hash of each written file, for idempotency verification. */
export async function writeCuratedDataset(dataDir: string, files: CuratedDatasetFiles): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  for (const [fileName, value] of Object.entries(files)) {
    const path = resolveSafePath(dataDir, ...CURATED_DIR_SEGMENTS, fileName);
    const serialized = stableStringify(value);
    await writeFileAtomic(path, serialized);
    hashes[fileName] = contentHash(value);
  }
  return hashes;
}
