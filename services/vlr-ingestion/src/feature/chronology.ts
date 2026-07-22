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
export interface MatchTimestampGroup<TMatch extends NormalizedMatch = NormalizedMatch> {
  readonly iso: string;
  readonly matches: readonly TMatch[];
}

/**
 * Sorts matches into deterministic chronological groups. Never mutates the
 * input array. Generic over the match type so a caller passing an enriched
 * subtype (e.g. TASK-057's `CuratedMatch`) gets that same type back on
 * `group.matches`, rather than being widened to the base `NormalizedMatch`.
 *
 * Precondition: every match must already have a non-null
 * `scheduledAt.iso` — a match with no unambiguously-normalized timestamp
 * (`dateNormalization.ts`'s `confidence: "none"`) cannot be chronologically
 * ordered at all, so callers (`stateEngine.ts`) must filter and reject such
 * matches before calling this function, never guess a position for them.
 */
export function groupMatchesChronologically<TMatch extends NormalizedMatch>(matches: readonly TMatch[]): readonly MatchTimestampGroup<TMatch>[] {
  const sorted = [...matches].sort((a, b) => {
    const isoCompare = a.scheduledAt.iso!.localeCompare(b.scheduledAt.iso!);
    if (isoCompare !== 0) return isoCompare;
    return a.internalId.localeCompare(b.internalId);
  });

  const groups: MatchTimestampGroup<TMatch>[] = [];
  for (const match of sorted) {
    const iso = match.scheduledAt.iso!;
    const last = groups[groups.length - 1];
    if (last && last.iso === iso) {
      (last.matches as TMatch[]).push(match);
    } else {
      groups.push({ iso, matches: [match] });
    }
  }
  return groups;
}
