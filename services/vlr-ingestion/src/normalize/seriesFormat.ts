/**
 * Series-format normalization — see docs/29-vlr-data-ingestion-foundation.md
 * ("Series and Map Normalization") and TASK-041 requirement 17.
 */
export type SeriesFormat = "bo1" | "bo3" | "bo5" | "unknown";

const PATTERNS: readonly { pattern: RegExp; format: SeriesFormat }[] = [
  { pattern: /^\s*bo\s*1\s*$/i, format: "bo1" },
  { pattern: /^\s*bo\s*3\s*$/i, format: "bo3" },
  { pattern: /^\s*bo\s*5\s*$/i, format: "bo5" },
  { pattern: /best\s*of\s*1/i, format: "bo1" },
  { pattern: /best\s*of\s*3/i, format: "bo3" },
  { pattern: /best\s*of\s*5/i, format: "bo5" },
];

export function normalizeSeriesFormat(raw: string | undefined): SeriesFormat {
  if (!raw) return "unknown";
  const match = PATTERNS.find(({ pattern }) => pattern.test(raw));
  return match?.format ?? "unknown";
}

const REQUIRED_MAP_WINS: Record<Exclude<SeriesFormat, "unknown">, number> = { bo1: 1, bo3: 2, bo5: 3 };

/** True when a team's completed map-win count would actually clinch the given series format. */
export function isValidSeriesWinCount(format: SeriesFormat, mapWinsForWinner: number): boolean {
  if (format === "unknown") return mapWinsForWinner >= 1;
  return mapWinsForWinner === REQUIRED_MAP_WINS[format];
}
