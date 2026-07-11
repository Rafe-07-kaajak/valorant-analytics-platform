import type { PredictionResult, Scenario } from "@repo/shared";

const MAX_ENTRIES = 200;

const cache = new Map<string, PredictionResult>();

export function scenarioCacheKey(scenario: Scenario): string {
  return [
    scenario.teamAId,
    scenario.teamBId,
    scenario.seriesFormat,
    [...scenario.mapIds].sort().join(","),
  ].join("|");
}

export function getCached(key: string): PredictionResult | undefined {
  return cache.get(key);
}

export function setCached(key: string, result: PredictionResult): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(key, result);
}
