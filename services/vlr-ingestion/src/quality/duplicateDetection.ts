import type { NormalizedMatch } from "../normalize/normalizedSchemas";

/**
 * Duplicate match detection — TASK-043 requirement 11. Provider match ID
 * remains authoritative (the filesystem store already keys one file per
 * `internalId`, so two *different* VLR match IDs are the only case this
 * module can ever see — a literal same-ID duplicate cannot exist on disk).
 * This module's job is purely diagnostic: surfacing *semantic* duplicate
 * candidates (same teams, event, and approximate kickoff) for human review.
 * It never merges two distinct match IDs automatically, regardless of how
 * strong the similarity is.
 */
export type DuplicateClassification = "cross-event-listing-duplicate" | "semantic-duplicate-candidate" | "rematch-not-duplicate";

export interface DuplicateMatchCandidate {
  readonly matchA: string;
  readonly matchB: string;
  readonly classification: DuplicateClassification;
  readonly confidence: "high" | "low";
  readonly evidence: readonly string[];
}

const SAME_DAY_WINDOW_MS = 24 * 60 * 60 * 1000;

function teamPairKey(match: NormalizedMatch): string {
  return [match.teamAId, match.teamBId].sort().join("|");
}

function mapSequenceKey(match: NormalizedMatch): string {
  return [...match.maps].sort((a, b) => a.order - b.order).map((m) => m.map.name).join(">");
}

/**
 * Groups matches by unordered team pair, then compares every pair within a
 * group for event/timestamp/score/map-sequence similarity. O(n^2) within
 * each team-pair bucket only — team pairs across a season are small, so
 * this stays well-bounded for this dataset's size (hundreds of matches).
 */
export function detectDuplicateMatchCandidates(matches: readonly NormalizedMatch[]): readonly DuplicateMatchCandidate[] {
  const byTeamPair = new Map<string, NormalizedMatch[]>();
  for (const match of matches) {
    const key = teamPairKey(match);
    const bucket = byTeamPair.get(key);
    if (bucket) bucket.push(match);
    else byTeamPair.set(key, [match]);
  }

  const candidates: DuplicateMatchCandidate[] = [];
  for (const bucket of byTeamPair.values()) {
    if (bucket.length < 2) continue;
    const sorted = [...bucket].sort((a, b) => a.internalId.localeCompare(b.internalId));

    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const matchA = sorted[i]!;
        const matchB = sorted[j]!;
        const evidence: string[] = [`Same team pair: ${matchA.teamAId} vs ${matchA.teamBId}.`];

        const sameEvent = matchA.eventId === matchB.eventId;
        evidence.push(sameEvent ? `Same parent event: ${matchA.eventId}.` : `Different parent events: ${matchA.eventId} vs ${matchB.eventId}.`);

        const timeA = matchA.scheduledAt.iso ? Date.parse(matchA.scheduledAt.iso) : null;
        const timeB = matchB.scheduledAt.iso ? Date.parse(matchB.scheduledAt.iso) : null;
        const closeInTime = timeA !== null && timeB !== null && Math.abs(timeA - timeB) <= SAME_DAY_WINDOW_MS;
        if (timeA !== null && timeB !== null) evidence.push(`Timestamp delta: ${Math.abs(timeA - timeB)}ms.`);

        const sameSeriesFormat = matchA.seriesFormat === matchB.seriesFormat;
        const sameMapSequence = mapSequenceKey(matchA) === mapSequenceKey(matchB) && mapSequenceKey(matchA).length > 0;
        evidence.push(sameSeriesFormat ? "Same series format." : "Different series format.");
        evidence.push(sameMapSequence ? "Same map sequence." : "Different map sequence.");

        let classification: DuplicateClassification;
        let confidence: "high" | "low";
        if (sameEvent && closeInTime && sameSeriesFormat && sameMapSequence) {
          // Same event, same day, same format, same maps in the same order —
          // most plausibly explained by the same real-world match having been
          // discovered/listed twice under the event (e.g. a bracket-view and
          // a schedule-view both linking it), not a genuine rematch.
          classification = "cross-event-listing-duplicate";
          confidence = "high";
        } else if (closeInTime && sameSeriesFormat && sameMapSequence) {
          classification = "semantic-duplicate-candidate";
          confidence = "low";
        } else {
          // Different day, format, or maps between two records for the same
          // team pair is exactly what a real rematch (a later stage, a
          // different event) looks like — never flagged as a duplicate.
          classification = "rematch-not-duplicate";
          confidence = "high";
        }

        candidates.push({ matchA: matchA.internalId, matchB: matchB.internalId, classification, confidence, evidence });
      }
    }
  }

  return candidates.sort((a, b) => a.matchA.localeCompare(b.matchA) || a.matchB.localeCompare(b.matchB));
}
