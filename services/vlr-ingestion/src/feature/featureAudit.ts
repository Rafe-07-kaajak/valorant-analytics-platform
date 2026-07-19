import type { NormalizedEvent, NormalizedMatch } from "../normalize/normalizedSchemas";
import { actuallyPlayedMaps } from "./mapInstances";

/**
 * Feature feasibility audit — TASK-044 requirement 2. Reports, for every
 * candidate signal considered during design, its real coverage in the
 * curated dataset and the leakage decision that was made about it. This is
 * the record of *why* each signal in `featureCatalog.ts` was included, and
 * *why* everything else was deliberately left out — generated from the
 * real dataset every time `pnpm ingest:vlr:features:audit` runs, not a
 * static document.
 */
export type LeakageRisk = "none" | "high" | "mitigated";

export interface SignalAuditEntry {
  readonly signal: string;
  readonly group: string;
  readonly sourceFields: readonly string[];
  readonly coverageCount: number;
  readonly coverageDenominator: number;
  readonly missingnessRate: number;
  readonly earliestUsableTimestamp: string | null;
  readonly availableStrictlyBeforeMatchStart: boolean;
  readonly leakageRisk: LeakageRisk;
  readonly fallback: string;
  readonly includedInTask044: boolean;
  readonly notes: string;
}

export interface FeatureFeasibilityAudit {
  readonly generatedAt: string;
  readonly matchCount: number;
  readonly eventCount: number;
  readonly entries: readonly SignalAuditEntry[];
}

function earliestScheduledIso(matches: readonly NormalizedMatch[]): string | null {
  const isos = matches.map((m) => m.scheduledAt.iso).filter((iso): iso is string => iso !== null).sort();
  return isos[0] ?? null;
}

export function buildFeatureFeasibilityAudit(matches: readonly NormalizedMatch[], events: readonly NormalizedEvent[], generatedAt: string): FeatureFeasibilityAudit {
  const totalMatches = matches.length;
  const earliest = earliestScheduledIso(matches);

  const matchesWithBothRosters = matches.filter((m) => (m.rosterSnapshots?.length ?? 0) === 2).length;
  const matchesWithAnyRoster = matches.filter((m) => (m.rosterSnapshots?.length ?? 0) > 0).length;

  const allPlayedMaps = matches.flatMap((m) => actuallyPlayedMaps(m));
  const mapsWithAttackDefenseSplit = allPlayedMaps.filter((m) => m.teamAAttackScore !== undefined && m.teamADefenseScore !== undefined).length;
  const unrecognizedMapInstances = allPlayedMaps.filter((m) => !m.map.recognized).length;

  const eventsWithRegion = events.filter((e) => e.region !== undefined).length;
  const eventsWithStage = events.filter((e) => e.stage !== undefined).length;

  const entries: SignalAuditEntry[] = [
    {
      signal: "Team prior match count / wins / losses / cumulative win rate",
      group: "team-history",
      sourceFields: ["matches.teamAId/teamBId", "matches.winnerId"],
      coverageCount: totalMatches,
      coverageDenominator: totalMatches,
      missingnessRate: 0,
      earliestUsableTimestamp: earliest,
      availableStrictlyBeforeMatchStart: true,
      leakageRisk: "none",
      fallback: "0 prior matches, neutral 0.5 win rate prior.",
      includedInTask044: true,
      notes: "Directly derivable from every curated match; no missing data possible.",
    },
    {
      signal: "Team recent form (last 3/5/10 matches, last 30/60 days)",
      group: "team-history",
      sourceFields: ["matches.scheduledAt", "matches.winnerId"],
      coverageCount: totalMatches,
      coverageDenominator: totalMatches,
      missingnessRate: 0,
      earliestUsableTimestamp: earliest,
      availableStrictlyBeforeMatchStart: true,
      leakageRisk: "none",
      fallback: "Fewer than the window size when early in a team's history; neutral 0.5 win rate prior when the window is empty.",
      includedInTask044: true,
      notes: "Window sample-count is always exported alongside the rate so a thin window is visible to the consumer.",
    },
    {
      signal: "Regional history / event-family history",
      group: "team-history",
      sourceFields: ["events.region", "events.eventFamily"],
      coverageCount: eventsWithRegion,
      coverageDenominator: events.length,
      missingnessRate: events.length > 0 ? 1 - eventsWithRegion / events.length : 0,
      earliestUsableTimestamp: earliest,
      availableStrictlyBeforeMatchStart: true,
      leakageRisk: "none",
      fallback: "Explicit \"unknown\" region category for international events with no region tag.",
      includedInTask044: true,
      notes: "Implemented as h2hMeetingsSameEventFamily/SameEventRegion and event-context fields, not a standalone team-regional-history feature (see 'Team home-region evidence' entry below for why).",
    },
    {
      signal: "Opponent-strength-adjusted history (average opponent Elo/win-rate, SoS, wins/losses vs above/below-median opponents)",
      group: "team-history",
      sourceFields: ["matches.winnerId", "derived Elo state"],
      coverageCount: totalMatches,
      coverageDenominator: totalMatches,
      missingnessRate: 0,
      earliestUsableTimestamp: earliest,
      availableStrictlyBeforeMatchStart: true,
      leakageRisk: "mitigated",
      fallback: "Initial Elo rating (1500) / neutral 0.5 win-rate fallback when no opponent history exists.",
      includedInTask044: true,
      notes: "Opponent strength values are frozen at the historical encounter time; the median threshold is a running tracker updated only after each timestamp group's updates apply — see docs/32 for the full leakage argument.",
    },
    {
      signal: "Map prior appearances / win rate / recent form / pool breadth / concentration / entropy",
      group: "map-history",
      sourceFields: ["matches.maps"],
      coverageCount: allPlayedMaps.length,
      coverageDenominator: allPlayedMaps.length,
      missingnessRate: 0,
      earliestUsableTimestamp: earliest,
      availableStrictlyBeforeMatchStart: true,
      leakageRisk: "none",
      fallback: "0 breadth / 0 concentration / 0 entropy for a team with no map history.",
      includedInTask044: true,
      notes: "Unplayed placeholders (\"N/A\"/\"TBD\"/empty) are excluded entirely, never counted as a played or unknown map.",
    },
    {
      signal: "Attack/defense side round performance",
      group: "map-history",
      sourceFields: ["matches.maps.teamAAttackScore/teamADefenseScore"],
      coverageCount: mapsWithAttackDefenseSplit,
      coverageDenominator: allPlayedMaps.length,
      missingnessRate: allPlayedMaps.length > 0 ? 1 - mapsWithAttackDefenseSplit / allPlayedMaps.length : 1,
      earliestUsableTimestamp: earliest,
      availableStrictlyBeforeMatchStart: true,
      leakageRisk: "none",
      fallback: "HasAttackDefenseSplitData=false and a neutral 0.5 rate when no split data exists for a team.",
      includedInTask044: true,
      notes: "Round totals per side are reconstructed from each side's own won-rounds plus the opponent's rounds won defending/attacking the same half.",
    },
    {
      signal: "Unknown-map count",
      group: "map-history",
      sourceFields: ["matches.maps.map.recognized"],
      coverageCount: unrecognizedMapInstances,
      coverageDenominator: allPlayedMaps.length,
      missingnessRate: 0,
      earliestUsableTimestamp: earliest,
      availableStrictlyBeforeMatchStart: true,
      leakageRisk: "none",
      fallback: "Not applicable — a count, not a rate.",
      includedInTask044: true,
      notes: "Currently observes the single previously-unseen map name ('Summit') documented in docs/31 as an open TASK-043 quality issue.",
    },
    {
      signal: "Current match's own map selection/veto order",
      group: "map-history",
      sourceFields: ["matches.maps"],
      coverageCount: 0,
      coverageDenominator: totalMatches,
      missingnessRate: 1,
      earliestUsableTimestamp: null,
      availableStrictlyBeforeMatchStart: false,
      leakageRisk: "high",
      fallback: "Not used as a feature at all.",
      includedInTask044: false,
      notes: "The curated schema does not record veto order or a pre-match map announcement timestamp, so there is no evidence the map selection was known before kickoff — treated strictly as post-match/target metadata (labelMapCountPlayed only), never a pre-match feature.",
    },
    {
      signal: "Roster continuity / player experience / debut detection",
      group: "roster-player",
      sourceFields: ["matches.rosterSnapshots"],
      coverageCount: matchesWithBothRosters,
      coverageDenominator: totalMatches,
      missingnessRate: totalMatches > 0 ? 1 - matchesWithBothRosters / totalMatches : 0,
      earliestUsableTimestamp: earliest,
      availableStrictlyBeforeMatchStart: true,
      leakageRisk: "none",
      fallback: "RosterSnapshotAvailable=false with neutral (0) defaults when a roster snapshot is missing or incomplete — never inferred from a later/current roster.",
      includedInTask044: true,
      notes: `${matchesWithAnyRoster - matchesWithBothRosters} match(es) have a partial (one-team-only) roster snapshot; still included with the missing side flagged, per requirement 12 ("incomplete roster must not automatically exclude the row").`,
    },
    {
      signal: "Player prior international / Masters-Champions appearances",
      group: "roster-player",
      sourceFields: ["roster-appearances", "events.tournamentLevel", "events.eventFamily"],
      coverageCount: matchesWithAnyRoster,
      coverageDenominator: totalMatches,
      missingnessRate: totalMatches > 0 ? 1 - matchesWithAnyRoster / totalMatches : 0,
      earliestUsableTimestamp: earliest,
      availableStrictlyBeforeMatchStart: true,
      leakageRisk: "none",
      fallback: "0 for a team with no roster snapshot.",
      includedInTask044: true,
      notes: "Derived purely from observed roster-appearance history, never a player's current/future team page.",
    },
    {
      signal: "Player handle-based identity/rename detection",
      group: "roster-player",
      sourceFields: ["identity/playerIdentity.ts"],
      coverageCount: 0,
      coverageDenominator: totalMatches,
      missingnessRate: 1,
      earliestUsableTimestamp: null,
      availableStrictlyBeforeMatchStart: false,
      leakageRisk: "none",
      fallback: "Not used.",
      includedInTask044: false,
      notes: "Player handles are not captured anywhere in the normalized schema (documented TASK-043 known limitation) — player identity here is provider ID only, never a handle.",
    },
    {
      signal: "Head-to-head prior meetings / win rate / map differential / recency",
      group: "head-to-head",
      sourceFields: ["matches.teamAId/teamBId", "matches.winnerId", "matches.maps"],
      coverageCount: totalMatches,
      coverageDenominator: totalMatches,
      missingnessRate: 0,
      earliestUsableTimestamp: earliest,
      availableStrictlyBeforeMatchStart: true,
      leakageRisk: "none",
      fallback: "0 prior meetings, neutral 0.5 win rate, \"unknown\" most-recent winner for a first-ever meeting.",
      includedInTask044: true,
      notes: "Keyed by the unordered team pair, oriented to the current match's own team A/B at read time.",
    },
    {
      signal: "Schedule/rest (days since last match, matches/maps in trailing windows, back-to-back, congestion)",
      group: "schedule-rest",
      sourceFields: ["matches.scheduledAt", "matches.eventId"],
      coverageCount: totalMatches,
      coverageDenominator: totalMatches,
      missingnessRate: 0,
      earliestUsableTimestamp: earliest,
      availableStrictlyBeforeMatchStart: true,
      leakageRisk: "none",
      fallback: "null + HasPriorMatch=false for a team's first-ever match.",
      includedInTask044: true,
      notes: "Congestion is measured at the event level (matches under the same event in the trailing 3 days), since no venue/stage-schedule field exists to measure it more granularly.",
    },
    {
      signal: "Event/tournament context (family, region, stage, level, season/month, international/league indicator, Masters-Champions indicator, best-of format)",
      group: "event-context",
      sourceFields: ["events.eventFamily", "events.region", "events.stage", "events.tournamentLevel", "matches.scheduledAt", "matches.seriesFormat"],
      coverageCount: totalMatches,
      coverageDenominator: totalMatches,
      missingnessRate: 0,
      earliestUsableTimestamp: earliest,
      availableStrictlyBeforeMatchStart: true,
      leakageRisk: "none",
      fallback: "Explicit \"unknown\" category for a missing region/stage; \"unknown\" seriesFormat when the source format couldn't be normalized.",
      includedInTask044: true,
      notes: `${eventsWithStage}/${events.length} curated events carry an explicit stage label.`,
    },
    {
      signal: "Match patch version",
      group: "event-context",
      sourceFields: [],
      coverageCount: 0,
      coverageDenominator: totalMatches,
      missingnessRate: 1,
      earliestUsableTimestamp: null,
      availableStrictlyBeforeMatchStart: false,
      leakageRisk: "none",
      fallback: "Not used.",
      includedInTask044: false,
      notes: "No patch field exists anywhere in the normalized schema (normalize/normalizedSchemas.ts) — there is nothing to extract without a parser change and a fresh backfill, both out of TASK-044's scope.",
    },
    {
      signal: "Team home-region evidence (for a same-region/cross-region matchup indicator)",
      group: "event-context",
      sourceFields: [],
      coverageCount: 0,
      coverageDenominator: totalMatches,
      missingnessRate: 1,
      earliestUsableTimestamp: null,
      availableStrictlyBeforeMatchStart: false,
      leakageRisk: "none",
      fallback: "Not used.",
      includedInTask044: false,
      notes: "The curated team registry (teams.json) carries no region field, and TASK-044's policy (docs/32, 'Region/Team Metadata Policy') explicitly forbids inferring a team's home region from a single opponent or display name — event region is used instead, which is a real, known-before-kickoff signal.",
    },
  ];

  return { generatedAt, matchCount: totalMatches, eventCount: events.length, entries };
}
