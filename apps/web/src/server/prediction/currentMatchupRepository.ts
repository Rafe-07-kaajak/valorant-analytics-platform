import { readFile } from "node:fs/promises";
import { resolveSafePath, safeFileName } from "@repo/vlr-ingestion/persistence/pathSafety";
import type { CuratedMatch, NormalizedEvent } from "@repo/vlr-ingestion";
import { loadRealPredictionConfig } from "./config";

/**
 * Server-only repository for Prediction Studio's real "current matchup"
 * mode — real-model integration task. Reads `curated/{matches.json,events.json}`
 * exactly as TASK-043 produced them (never mutated), independent of
 * Historical Replay's `sourceMode`/runtime-package concept: a current
 * prediction always needs the full raw curated history to replay real state
 * for an arbitrary team pair, which the packaged historical export (label-
 * stripped, feature-row-shaped) cannot provide.
 */

export interface CurrentMatchupDataset {
  readonly matches: readonly CuratedMatch[];
  readonly eventsById: ReadonlyMap<string, NormalizedEvent>;
  readonly sourceDatasetVersion: string;
  /** The true end of real ingested history (max `scheduledAt` across every curated match) — never wall-clock time, so a "current" prediction stays deterministic and tied to what data actually exists. */
  readonly cutoffIso: string;
}

interface CuratedDatasetManifestSummary {
  readonly curatedDatasetVersion: string;
}

let cache: CurrentMatchupDataset | null = null;

async function readJsonFile<T>(dir: string, fileName: string): Promise<T> {
  const path = resolveSafePath(dir, safeFileName(fileName));
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw) as T;
}

function computeCutoffIso(matches: readonly CuratedMatch[]): string | null {
  let latest: string | null = null;
  for (const match of matches) {
    const iso = match.scheduledAt.iso;
    if (iso && (!latest || iso > latest)) latest = iso;
  }
  return latest;
}

async function loadCurrentMatchupDataset(): Promise<CurrentMatchupDataset> {
  const config = loadRealPredictionConfig();
  const curatedDir = resolveSafePath(config.featureDataDir, "curated");

  const [manifest, matches, events] = await Promise.all([
    readJsonFile<CuratedDatasetManifestSummary>(curatedDir, "dataset-manifest.json"),
    readJsonFile<CuratedMatch[]>(curatedDir, "matches.json"),
    readJsonFile<NormalizedEvent[]>(curatedDir, "events.json"),
  ]);

  const cutoffIso = computeCutoffIso(matches);
  if (!cutoffIso) {
    throw new Error("Curated dataset has no match with a resolvable scheduled timestamp.");
  }

  return {
    matches,
    eventsById: new Map(events.map((event) => [event.internalId, event])),
    sourceDatasetVersion: manifest.curatedDatasetVersion,
    cutoffIso,
  };
}

/** Memoized once successfully loaded — mirrors every other real-prediction repository's convention. Returns `null` (never throws) when the dataset is unavailable. */
export async function getCurrentMatchupDataset(): Promise<CurrentMatchupDataset | null> {
  if (cache) return cache;
  try {
    cache = await loadCurrentMatchupDataset();
  } catch {
    return null;
  }
  return cache;
}

export function resetCurrentMatchupRepositoryCacheForTesting(): void {
  cache = null;
}
