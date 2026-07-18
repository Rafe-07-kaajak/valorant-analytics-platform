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
import { computeCuratedDatasetVersion, computeIdentityMappingVersion } from "./curatedVersion";

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

  const curatedMatches = input.matches
    .filter((m) => input.matchCategoryByInternalId.get(m.internalId) === "current-approved" && !quarantined.has(m.internalId))
    .sort((a, b) => a.internalId.localeCompare(b.internalId));

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
