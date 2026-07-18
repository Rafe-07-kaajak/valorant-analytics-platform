import { mkdir, readFile, rename, writeFile, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";
import { IngestionError } from "../errors";
import { resolveSafePath, safeFileName } from "./pathSafety";
import type {
  DiscoveryIndexStore,
  EventDiscoveryCheckpoint,
  FailureLedgerEntry,
  FailureLedgerStore,
  IngestionCheckpointStore,
  IngestionStore,
  MatchDetailCheckpoint,
  MatchDiscoveryCheckpoint,
  NormalizedRecordStore,
  RawDocumentRecord,
  RawRecordStore,
  UpsertResult,
} from "./types";

function contentHashOf(record: unknown): string | undefined {
  const metadata = (record as { metadata?: { contentHash?: unknown } } | null)?.metadata;
  return typeof metadata?.contentHash === "string" ? metadata.contentHash : undefined;
}

/**
 * Normalized records carry `metadata.contentHash`, which deliberately
 * excludes volatile fields like `fetchedAt`/`parsedAt` (see
 * `normalize/contentHash.ts`). Comparing that hash — instead of the full
 * serialized record — is what makes repeated ingestion of unchanged source
 * content a true no-op rather than rewriting the file on every run.
 */
function recordChanged(existing: unknown, incoming: unknown): boolean {
  if (existing === null || existing === undefined) return true;
  const existingHash = contentHashOf(existing);
  const incomingHash = contentHashOf(incoming);
  if (existingHash !== undefined && incomingHash !== undefined) return existingHash !== incomingHash;
  return JSON.stringify(existing) !== JSON.stringify(incoming);
}

/**
 * Local filesystem-backed development store — see
 * docs/29-vlr-data-ingestion-foundation.md ("Persistence Policy") and
 * TASK-041 requirement 19/20. No database exists in this repository yet
 * (see docs/06-data-architecture.md's raw/normalized layering, currently
 * implemented in-memory by `@repo/prediction-engine`'s synthetic data), so
 * this is the initial durable store: Node-only, every write atomic
 * (temp-file + rename), every path validated against `dataDir` via
 * `resolveSafePath`.
 */
export class FilesystemIngestionStore implements IngestionStore, RawRecordStore, NormalizedRecordStore, IngestionCheckpointStore, DiscoveryIndexStore, FailureLedgerStore {
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  private async writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.tmp-${randomBytes(6).toString("hex")}`;
    await writeFile(tempPath, JSON.stringify(data, null, 2), "utf-8");
    await rename(tempPath, filePath);
  }

  private async readJsonSafe<T>(filePath: string): Promise<T | null> {
    let raw: string;
    try {
      raw = await readFile(filePath, "utf-8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw new IngestionError("persistence_failure", `Failed to read "${filePath}": ${String(error)}`);
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new IngestionError("persistence_failure", `File "${filePath}" contains malformed JSON.`);
    }
  }

  // --- RawRecordStore -----------------------------------------------------

  private rawPath(provider: string, entityType: string, externalId: string): string {
    return resolveSafePath(this.rootDir, "raw", safeFileName(provider), safeFileName(entityType), `${safeFileName(externalId)}.json`);
  }

  async upsertRawDocument<T>(record: RawDocumentRecord<T>): Promise<UpsertResult> {
    const path = this.rawPath(record.provider, record.entityType, record.externalId);
    const existing = await this.readJsonSafe<RawDocumentRecord<T>>(path);
    if (existing && existing.contentHash === record.contentHash) return { changed: false };
    await this.writeJsonAtomic(path, record);
    return { changed: true };
  }

  async getRawDocument<T>(provider: string, entityType: string, externalId: string): Promise<RawDocumentRecord<T> | null> {
    return this.readJsonSafe<RawDocumentRecord<T>>(this.rawPath(provider, entityType, externalId));
  }

  // --- NormalizedRecordStore ----------------------------------------------

  private normalizedPath(entityType: string, internalId: string): string {
    return resolveSafePath(this.rootDir, "normalized", safeFileName(entityType), `${safeFileName(internalId)}.json`);
  }

  private indexPath(name: string): string {
    return resolveSafePath(this.rootDir, "normalized", "_index", `${name}.json`);
  }

  private async addToIndex(name: string, internalId: string): Promise<void> {
    const existing = (await this.readJsonSafe<string[]>(this.indexPath(name))) ?? [];
    if (!existing.includes(internalId)) {
      await this.writeJsonAtomic(this.indexPath(name), [...existing, internalId].sort());
    }
  }

  async upsertNormalizedEntity<T>(entityType: string, internalId: string, record: T): Promise<UpsertResult> {
    const path = this.normalizedPath(entityType, internalId);
    const existing = await this.readJsonSafe<T>(path);
    const changed = recordChanged(existing, record);
    if (changed) await this.writeJsonAtomic(path, record);

    if (entityType === "team" && (record as { mapped?: boolean }).mapped === false) {
      await this.addToIndex("unmapped-teams", internalId);
    }
    if (entityType === "event" && (record as { eventFamily?: string }).eventFamily === "unknown") {
      await this.addToIndex("unknown-events", internalId);
    }

    return { changed };
  }

  async getNormalizedEntity<T>(entityType: string, internalId: string): Promise<T | null> {
    return this.readJsonSafe<T>(this.normalizedPath(entityType, internalId));
  }

  async listUnmappedTeams(): Promise<readonly string[]> {
    return (await this.readJsonSafe<string[]>(this.indexPath("unmapped-teams"))) ?? [];
  }

  async listUnknownEvents(): Promise<readonly string[]> {
    return (await this.readJsonSafe<string[]>(this.indexPath("unknown-events"))) ?? [];
  }

  // --- IngestionCheckpointStore --------------------------------------------

  private checkpointPath(kind: string, key: string): string {
    return resolveSafePath(this.rootDir, "checkpoints", kind, `${safeFileName(key)}.json`);
  }

  async readEventDiscoveryCheckpoint(scopeKey: string): Promise<EventDiscoveryCheckpoint | null> {
    return this.readJsonSafe(this.checkpointPath("event-discovery", scopeKey));
  }

  async writeEventDiscoveryCheckpoint(scopeKey: string, checkpoint: EventDiscoveryCheckpoint): Promise<void> {
    await this.writeJsonAtomic(this.checkpointPath("event-discovery", scopeKey), checkpoint);
  }

  async readMatchDiscoveryCheckpoint(eventExternalId: string): Promise<MatchDiscoveryCheckpoint | null> {
    return this.readJsonSafe(this.checkpointPath("match-discovery", eventExternalId));
  }

  async writeMatchDiscoveryCheckpoint(eventExternalId: string, checkpoint: MatchDiscoveryCheckpoint): Promise<void> {
    await this.writeJsonAtomic(this.checkpointPath("match-discovery", eventExternalId), checkpoint);
  }

  async readMatchDetailCheckpoint(matchExternalId: string): Promise<MatchDetailCheckpoint | null> {
    return this.readJsonSafe(this.checkpointPath("match-detail", matchExternalId));
  }

  async writeMatchDetailCheckpoint(matchExternalId: string, checkpoint: MatchDetailCheckpoint): Promise<void> {
    await this.writeJsonAtomic(this.checkpointPath("match-detail", matchExternalId), checkpoint);
  }

  // --- DiscoveryIndexStore --------------------------------------------------

  private discoverySummaryPath(scopeKey: string): string {
    return resolveSafePath(this.rootDir, "discovery", `${safeFileName(scopeKey)}.json`);
  }

  async recordDiscoverySummary<T>(scopeKey: string, summary: T): Promise<void> {
    await this.writeJsonAtomic(this.discoverySummaryPath(scopeKey), summary);
  }

  async getDiscoverySummary<T>(scopeKey: string): Promise<T | null> {
    return this.readJsonSafe<T>(this.discoverySummaryPath(scopeKey));
  }

  // --- FailureLedgerStore ---------------------------------------------------

  private failureLedgerPath(): string {
    return resolveSafePath(this.rootDir, "failures", "ledger.json");
  }

  private ledgerKey(entityType: FailureLedgerEntry["entityType"], externalId: string, operation: string): string {
    return `${entityType}:${externalId}:${operation}`;
  }

  private async readLedger(): Promise<FailureLedgerEntry[]> {
    return (await this.readJsonSafe<FailureLedgerEntry[]>(this.failureLedgerPath())) ?? [];
  }

  async recordFailure(
    entry: Omit<FailureLedgerEntry, "attemptCount" | "firstFailureAt" | "latestFailureAt" | "resolved">,
    now: string,
  ): Promise<FailureLedgerEntry> {
    const ledger = await this.readLedger();
    const key = this.ledgerKey(entry.entityType, entry.externalId, entry.operation);
    const existingIndex = ledger.findIndex((e) => this.ledgerKey(e.entityType, e.externalId, e.operation) === key);

    const updated: FailureLedgerEntry = {
      ...entry,
      attemptCount: existingIndex >= 0 ? ledger[existingIndex]!.attemptCount + 1 : 1,
      firstFailureAt: existingIndex >= 0 ? ledger[existingIndex]!.firstFailureAt : now,
      latestFailureAt: now,
      resolved: false,
    };

    if (existingIndex >= 0) ledger[existingIndex] = updated;
    else ledger.push(updated);

    await this.writeJsonAtomic(this.failureLedgerPath(), ledger);
    return updated;
  }

  async markFailureResolved(entityType: FailureLedgerEntry["entityType"], externalId: string, operation: string): Promise<void> {
    const ledger = await this.readLedger();
    const key = this.ledgerKey(entityType, externalId, operation);
    const index = ledger.findIndex((e) => this.ledgerKey(e.entityType, e.externalId, e.operation) === key);
    if (index < 0) return;
    ledger[index] = { ...ledger[index]!, resolved: true };
    await this.writeJsonAtomic(this.failureLedgerPath(), ledger);
  }

  async listFailures(filter?: { resolved?: boolean; retryable?: boolean }): Promise<readonly FailureLedgerEntry[]> {
    const ledger = await this.readLedger();
    return ledger.filter((entry) => (filter?.resolved === undefined || entry.resolved === filter.resolved) && (filter?.retryable === undefined || entry.retryable === filter.retryable));
  }

  /** Test-only convenience: removes the entire store directory. Never called by production code. */
  async _clearForTests(): Promise<void> {
    await rm(this.rootDir, { recursive: true, force: true });
  }
}
