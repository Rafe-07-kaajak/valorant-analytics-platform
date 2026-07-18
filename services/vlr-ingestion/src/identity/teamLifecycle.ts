/**
 * Team lifecycle and rename handling — TASK-043 requirement 6. Operates
 * over a caller-supplied list of *name observations* (a VLR team ID's
 * display name as seen on a specific fetched page, at a specific time) —
 * provider-neutral, and deliberately independent of whether the dataset
 * currently captures display names for every team (it largely does not;
 * see docs/31-vlr-identity-and-data-quality.md's "Known limitations").
 * Nothing here invents a team ID or a display name: a period is only ever
 * built from an actual observation.
 */
export interface TeamNameObservation {
  readonly vlrTeamId: string;
  readonly displayName: string;
  readonly observedAt: string;
  readonly sourceUrl: string;
}

export interface TeamLifecyclePeriod {
  readonly vlrTeamId: string;
  readonly displayName: string;
  /** First observation timestamp for this exact display name. */
  readonly firstSeen: string;
  /** Latest observation timestamp for this exact display name. */
  readonly lastSeen: string;
  readonly sourceUrls: readonly string[];
}

/**
 * Groups observations by VLR team ID into a chronological name-history
 * timeline. Two or more distinct display names for the *same* VLR team ID
 * is a same-ID rename (requirement 6: "same VLR team ID generally means
 * same provider identity") — the returned periods make that rename
 * explicit rather than silently collapsing it to whichever name was seen
 * last.
 */
export function buildTeamLifecycleTimeline(observations: readonly TeamNameObservation[]): Map<string, TeamLifecyclePeriod[]> {
  const byTeamId = new Map<string, TeamNameObservation[]>();
  for (const observation of observations) {
    const bucket = byTeamId.get(observation.vlrTeamId);
    if (bucket) bucket.push(observation);
    else byTeamId.set(observation.vlrTeamId, [observation]);
  }

  const result = new Map<string, TeamLifecyclePeriod[]>();
  for (const [vlrTeamId, teamObservations] of byTeamId) {
    const byName = new Map<string, TeamNameObservation[]>();
    for (const observation of teamObservations) {
      const bucket = byName.get(observation.displayName);
      if (bucket) bucket.push(observation);
      else byName.set(observation.displayName, [observation]);
    }

    const periods: TeamLifecyclePeriod[] = [];
    for (const [displayName, group] of byName) {
      const sorted = [...group].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
      periods.push({
        vlrTeamId,
        displayName,
        firstSeen: sorted[0]!.observedAt,
        lastSeen: sorted[sorted.length - 1]!.observedAt,
        sourceUrls: [...new Set(sorted.map((o) => o.sourceUrl))],
      });
    }
    periods.sort((a, b) => a.firstSeen.localeCompare(b.firstSeen));
    result.set(vlrTeamId, periods);
  }
  return result;
}

export interface RenameEvidence {
  readonly vlrTeamId: string;
  readonly names: readonly string[];
}

/** A VLR team ID with more than one distinct observed display name — a same-ID rename, never a merge decision by itself. */
export function detectRenames(timeline: Map<string, TeamLifecyclePeriod[]>): readonly RenameEvidence[] {
  const renames: RenameEvidence[] = [];
  for (const [vlrTeamId, periods] of timeline) {
    if (periods.length > 1) renames.push({ vlrTeamId, names: periods.map((p) => p.displayName) });
  }
  return renames;
}

/**
 * The inverse situation (requirement 6: "same display name with different
 * VLR IDs is not automatically the same team"): two or more distinct VLR
 * team IDs observed under the exact same display name. Surfaced for human
 * review only — this function never merges the IDs.
 */
export function detectSharedDisplayNames(observations: readonly TeamNameObservation[]): ReadonlyMap<string, readonly string[]> {
  const idsByName = new Map<string, Set<string>>();
  for (const observation of observations) {
    const bucket = idsByName.get(observation.displayName);
    if (bucket) bucket.add(observation.vlrTeamId);
    else idsByName.set(observation.displayName, new Set([observation.vlrTeamId]));
  }
  const shared = new Map<string, readonly string[]>();
  for (const [name, ids] of idsByName) {
    if (ids.size > 1) shared.set(name, [...ids]);
  }
  return shared;
}
