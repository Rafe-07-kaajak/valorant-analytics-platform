import { describe, expect, it } from "vitest";
import { buildNormalizedMatch } from "../testUtils/normalizedMatchFixture";
import type { NormalizedEvent } from "../normalize/normalizedSchemas";
import { runFeatureStateEngine } from "./stateEngine";
import { buildEventsById } from "./curatedSource";
import { DEFAULT_ELO_CONFIG } from "./versions";

function buildEvent(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    internalId: "vlr:event:1",
    name: "Test Event",
    status: "completed",
    startDate: { iso: "2025-01-01T00:00:00.000Z", raw: "raw", confidence: "high" },
    endDate: { iso: "2025-01-10T00:00:00.000Z", raw: "raw", confidence: "high" },
    tournamentLevel: "league",
    region: "americas",
    eventFamily: "vct-americas",
    classification: { classification: "vct-americas", confidence: "authoritative", reason: "r", evidence: [] },
    metadata: { provider: "vlr", providerExternalId: "1", sourceUrl: "https://www.vlr.gg/event/1", fetchedAt: "t", parsedAt: "t", schemaVersion: "1.0.0", contentHash: "h" },
    ...overrides,
  };
}

function options() {
  return { eloConfig: DEFAULT_ELO_CONFIG, sourceDatasetVersion: "src-v1" };
}

describe("runFeatureStateEngine", () => {
  it("produces one row per eligible match with cold-start defaults for the first meeting", () => {
    const match = buildNormalizedMatch();
    const events = buildEventsById([buildEvent()]);
    const { rows, rejected } = runFeatureStateEngine([match], events, options());

    expect(rejected).toHaveLength(0);
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.teamAPriorMatchCount).toBe(0);
    expect(row.teamAIsColdStart).toBe(true);
    expect(row.teamAEloRating).toBe(1500);
    expect(row.teamBEloRating).toBe(1500);
    expect(row.labelTeamAWin).toBe(1);
    expect(row.labelWinnerProviderId).toBe("fnatic");
    expect(row.h2hPriorMeetingCount).toBe(0);
  });

  it("never lets a match's own result influence its own row (current-match leakage check)", () => {
    const match = buildNormalizedMatch();
    const events = buildEventsById([buildEvent()]);
    const { rows } = runFeatureStateEngine([match], events, options());
    // teamA won this match, but its own prior-win count must still be 0 pre-match.
    expect(rows[0]!.teamAPriorWins).toBe(0);
  });

  it("updates state chronologically so a later match sees an earlier one's result", () => {
    const first = buildNormalizedMatch({ internalId: "vlr:match:1", scheduledAt: { iso: "2025-01-01T00:00:00.000Z", raw: "r", confidence: "high" } });
    const second = buildNormalizedMatch({
      internalId: "vlr:match:2",
      scheduledAt: { iso: "2025-01-08T00:00:00.000Z", raw: "r", confidence: "high" },
      metadata: { provider: "vlr", providerExternalId: "2", sourceUrl: "https://www.vlr.gg/2", fetchedAt: "t", parsedAt: "t", schemaVersion: "1.0.0", contentHash: "hash2" },
    });
    const events = buildEventsById([buildEvent()]);
    const { rows } = runFeatureStateEngine([first, second], events, options());
    const secondRow = rows.find((r) => r.matchInternalId === "vlr:match:2")!;
    expect(secondRow.teamAPriorMatchCount).toBe(1);
    expect(secondRow.teamAPriorWins).toBe(1);
    expect(secondRow.h2hPriorMeetingCount).toBe(1);
    expect(secondRow.h2hTeamAWins).toBe(1);
  });

  it("does not let a future match affect an earlier row (reversed input order yields identical output)", () => {
    const first = buildNormalizedMatch({ internalId: "vlr:match:1", scheduledAt: { iso: "2025-01-01T00:00:00.000Z", raw: "r", confidence: "high" } });
    const second = buildNormalizedMatch({
      internalId: "vlr:match:2",
      scheduledAt: { iso: "2025-01-08T00:00:00.000Z", raw: "r", confidence: "high" },
      metadata: { provider: "vlr", providerExternalId: "2", sourceUrl: "https://www.vlr.gg/2", fetchedAt: "t", parsedAt: "t", schemaVersion: "1.0.0", contentHash: "hash2" },
    });
    const events = buildEventsById([buildEvent()]);
    const forward = runFeatureStateEngine([first, second], events, options());
    const reversed = runFeatureStateEngine([second, first], events, options());
    expect(forward.rows).toEqual(reversed.rows);
    const firstRowForward = forward.rows.find((r) => r.matchInternalId === "vlr:match:1")!;
    expect(firstRowForward.teamAPriorMatchCount).toBe(0);
  });

  it("groups identical timestamps and emits both rows from the same pre-group state", () => {
    const sameTime = "2025-01-01T00:00:00.000Z";
    const matchOne = buildNormalizedMatch({
      internalId: "vlr:match:1",
      teamAId: "team-x",
      teamBId: "team-y",
      winnerId: "team-x",
      scheduledAt: { iso: sameTime, raw: "r", confidence: "high" },
      rosterSnapshots: [
        { teamInternalId: "team-x", asOf: sameTime, playerInternalIds: ["p1", "p2", "p3", "p4", "p5"] },
        { teamInternalId: "team-y", asOf: sameTime, playerInternalIds: ["p6", "p7", "p8", "p9", "p10"] },
      ],
      metadata: { provider: "vlr", providerExternalId: "1", sourceUrl: "https://www.vlr.gg/1", fetchedAt: "t", parsedAt: "t", schemaVersion: "1.0.0", contentHash: "h1" },
    });
    const matchTwo = buildNormalizedMatch({
      internalId: "vlr:match:2",
      teamAId: "team-x",
      teamBId: "team-z",
      winnerId: "team-z",
      scheduledAt: { iso: sameTime, raw: "r", confidence: "high" },
      rosterSnapshots: [
        { teamInternalId: "team-x", asOf: sameTime, playerInternalIds: ["p1", "p2", "p3", "p4", "p5"] },
        { teamInternalId: "team-z", asOf: sameTime, playerInternalIds: ["p11", "p12", "p13", "p14", "p15"] },
      ],
      metadata: { provider: "vlr", providerExternalId: "2", sourceUrl: "https://www.vlr.gg/2", fetchedAt: "t", parsedAt: "t", schemaVersion: "1.0.0", contentHash: "h2" },
    });
    const events = buildEventsById([buildEvent()]);
    const { rows } = runFeatureStateEngine([matchOne, matchTwo], events, options());
    const rowOne = rows.find((r) => r.matchInternalId === "vlr:match:1")!;
    const rowTwo = rows.find((r) => r.matchInternalId === "vlr:match:2")!;
    // team-x played twice at the exact same instant — the second match must
    // not see the first match's result (same-timestamp leakage check).
    expect(rowOne.teamAPriorMatchCount).toBe(0);
    expect(rowTwo.teamAPriorMatchCount).toBe(0);
  });

  it("rejects a match whose winner is neither team A nor team B", () => {
    const match = buildNormalizedMatch({ winnerId: "some-other-team" });
    const events = buildEventsById([buildEvent()]);
    const { rows, rejected } = runFeatureStateEngine([match], events, options());
    expect(rows).toHaveLength(0);
    expect(rejected).toHaveLength(1);
  });
});
