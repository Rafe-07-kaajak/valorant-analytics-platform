import type { NormalizedMatch } from "../normalize/normalizedSchemas";

/**
 * Chronological ordering and simultaneous-timestamp grouping — TASK-044
 * requirement 4. Matches are sorted by authoritative `scheduledAt.iso`
 * ascending; matches sharing the exact same `scheduledAt.iso` are grouped
 * together so the state engine can emit every row in the group from the
 * same pre-group state before applying any of their results (see
 * `stateEngine.ts`). Within a group, `internalId` (which embeds the stable
 * provider match ID, e.g. `vlr:match:448597`) is the deterministic
 * tie-breaker — the same tie-breaker convention TASK-043's curated export
 * already uses for match ordering.
 */
export interface MatchTimestampGroup {
  readonly iso: string;
  readonly matches: readonly NormalizedMatch[];
}

/**
 * Sorts matches into deterministic chronological groups. Never mutates the
 * input array.
 *
 * Precondition: every match must already have a non-null
 * `scheduledAt.iso` — a match with no unambiguously-normalized timestamp
 * (`dateNormalization.ts`'s `confidence: "none"`) cannot be chronologically
 * ordered at all, so callers (`stateEngine.ts`) must filter and reject such
 * matches before calling this function, never guess a position for them.
 */
export function groupMatchesChronologically(matches: readonly NormalizedMatch[]): readonly MatchTimestampGroup[] {
  const sorted = [...matches].sort((a, b) => {
    const isoCompare = a.scheduledAt.iso!.localeCompare(b.scheduledAt.iso!);
    if (isoCompare !== 0) return isoCompare;
    return a.internalId.localeCompare(b.internalId);
  });

  const groups: MatchTimestampGroup[] = [];
  for (const match of sorted) {
    const iso = match.scheduledAt.iso!;
    const last = groups[groups.length - 1];
    if (last && last.iso === iso) {
      (last.matches as NormalizedMatch[]).push(match);
    } else {
      groups.push({ iso, matches: [match] });
    }
  }
  return groups;
}
