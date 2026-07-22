import { readFile } from "node:fs/promises";
import { resolveSafePath } from "../persistence/pathSafety";
import { IngestionError } from "../errors";
import type { NormalizedEvent } from "../normalize/normalizedSchemas";
import type { CuratedMatch } from "../curate/curatedExport";

/**
 * Read-only loader over TASK-043's curated dataset export
 * (`<dataDir>/curated/*.json`) — the only input TASK-044 reads. Never
 * touches the raw normalized store, never makes a network request, and
 * never mutates a curated source file.
 */
export interface CuratedDatasetManifestFile {
  readonly curatedDatasetVersion: string;
  readonly curatedMatchCount: number;
  readonly curatedEventCount: number;
  readonly eligibleMatchCount: number;
  readonly sourceDatasetVersion: string;
}

export interface CuratedFeatureSource {
  readonly matches: readonly CuratedMatch[];
  readonly events: readonly NormalizedEvent[];
  readonly manifest: CuratedDatasetManifestFile;
}

async function readJson<T>(dataDir: string, fileName: string): Promise<T> {
  const path = resolveSafePath(dataDir, "curated", fileName);
  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch {
    throw new IngestionError("checkpoint_failure", `Curated dataset file "${fileName}" not found under "${dataDir}/curated/". Run \`pnpm ingest:vlr:curate\` first.`);
  }
  return JSON.parse(raw) as T;
}

/**
 * Loads the curated matches/events/manifest strictly needed for feature
 * engineering. Matches are filtered to `trainingEligibility.eligible` as a
 * defense-in-depth check — TASK-043's curated export already excludes
 * quarantined/non-current-approved matches, so this is expected to be a
 * no-op against the real dataset, never a silent widening of scope.
 */
export async function loadCuratedFeatureSource(dataDir: string): Promise<CuratedFeatureSource> {
  const [matches, events, manifest] = await Promise.all([
    readJson<CuratedMatch[]>(dataDir, "matches.json"),
    readJson<NormalizedEvent[]>(dataDir, "events.json"),
    readJson<CuratedDatasetManifestFile>(dataDir, "dataset-manifest.json"),
  ]);

  const eligible = matches.filter((m) => m.trainingEligibility.eligible);
  return { matches: eligible, events, manifest };
}

export function buildEventsById(events: readonly NormalizedEvent[]): ReadonlyMap<string, NormalizedEvent> {
  return new Map(events.map((event) => [event.internalId, event]));
}
