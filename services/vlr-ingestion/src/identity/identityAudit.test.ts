import { describe, expect, it } from "vitest";
import { buildEventAudit, buildPlayerAudit, buildTeamAudit } from "./identityAudit";
import { buildNormalizedMatch } from "../testUtils/normalizedMatchFixture";
import type { VlrTeamMappingEntry } from "./teamMapping";
import type { NormalizedEvent } from "../normalize/normalizedSchemas";

const MAPPING: readonly VlrTeamMappingEntry[] = [{ vlrTeamId: "1034", internalTeamId: "nrg", reason: "r" }];

describe("buildTeamAudit", () => {
  it("counts match and event appearances per team, and first/last seen", () => {
    const matches = [
      buildNormalizedMatch({ internalId: "vlr:match:1", teamAId: "fnatic", teamBId: "team-liquid", eventId: "vlr:event:1", scheduledAt: { iso: "2025-01-01T00:00:00.000Z", raw: "r", confidence: "high" } }),
      buildNormalizedMatch({ internalId: "vlr:match:2", teamAId: "fnatic", teamBId: "nrg", eventId: "vlr:event:2", scheduledAt: { iso: "2025-06-01T00:00:00.000Z", raw: "r", confidence: "high" } }),
    ];
    const audit = buildTeamAudit(matches, MAPPING);
    const fnatic = audit.entries.find((e) => e.teamInternalId === "fnatic")!;
    expect(fnatic.matchAppearances).toBe(2);
    expect(fnatic.eventAppearances).toBe(2);
    expect(fnatic.firstSeen).toBe("2025-01-01T00:00:00.000Z");
    expect(fnatic.lastSeen).toBe("2025-06-01T00:00:00.000Z");
  });

  it("distinguishes mapped from unmapped teams by internal ID prefix", () => {
    const matches = [buildNormalizedMatch({ teamAId: "nrg", teamBId: "vlr:team:9999" })];
    const audit = buildTeamAudit(matches, MAPPING);
    expect(audit.entries.find((e) => e.teamInternalId === "nrg")!.mapped).toBe(true);
    expect(audit.entries.find((e) => e.teamInternalId === "vlr:team:9999")!.mapped).toBe(false);
    expect(audit.mappedTeamCount).toBe(1);
    expect(audit.unmappedTeamCount).toBe(1);
  });

  it("reports which of the 32 currently-supported teams remain unresolved", () => {
    const audit = buildTeamAudit([], MAPPING);
    expect(audit.currentSupportedTeamsMapped).toEqual(["nrg"]);
    expect(audit.currentSupportedTeamsUnresolved).toContain("fnatic");
    expect(audit.currentSupportedTeamCandidates).toHaveLength(32);
  });
});

describe("buildPlayerAudit", () => {
  it("counts roster appearances and teams represented per player", () => {
    const audit = buildPlayerAudit([buildNormalizedMatch()]);
    expect(audit.uniquePlayerIds).toBe(10);
    expect(audit.rosterAppearanceCount).toBe(10);
    expect(audit.incompleteRosterSnapshotCount).toBe(0);
  });

  it("flags an incomplete roster snapshot", () => {
    const match = buildNormalizedMatch({ rosterSnapshots: [{ teamInternalId: "fnatic", asOf: "t", playerInternalIds: ["vlr:player:1"] }] });
    expect(buildPlayerAudit([match]).incompleteRosterSnapshotCount).toBe(1);
  });
});

describe("buildEventAudit", () => {
  function event(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
    return {
      internalId: "vlr:event:1",
      name: "Test",
      status: "completed",
      startDate: { iso: "2025-01-01T00:00:00.000Z", raw: "r", confidence: "high" },
      endDate: { iso: "2025-02-01T00:00:00.000Z", raw: "r", confidence: "high" },
      tournamentLevel: "league",
      eventFamily: "vct-americas",
      classification: { classification: "vct-americas", confidence: "high", reason: "r", evidence: [] },
      metadata: { provider: "vlr", providerExternalId: "1", sourceUrl: "u", fetchedAt: "t", parsedAt: "t", schemaVersion: "1.0.0", contentHash: "h" },
      ...overrides,
    };
  }

  it("counts matches per event and detects duplicate event records", () => {
    const events = [event(), event()];
    const matches = [buildNormalizedMatch({ eventId: "vlr:event:1" })];
    const audit = buildEventAudit(events, matches);
    expect(audit.duplicateEventRecordCount).toBe(1);
    expect(audit.entries[0]!.matchCount).toBe(1);
  });
});
