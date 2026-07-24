import { describe, expect, it } from "vitest";
import { buildNormalizedMatch } from "../testUtils/normalizedMatchFixture";
import { buildTeamMappingLookup, type VlrTeamMappingEntry } from "../identity/teamMapping";
import { remapUnmappedTeamIdentities } from "./identityRemap";

function mappingEntry(overrides: Partial<VlrTeamMappingEntry> = {}): VlrTeamMappingEntry {
  return { vlrTeamId: "11058", internalTeamId: "g2-esports", reason: "test", ...overrides };
}

describe("remapUnmappedTeamIdentities", () => {
  it("remaps teamAId, teamBId, winnerId, map winners, and roster snapshots consistently from one fixture", () => {
    const match = buildNormalizedMatch({
      teamAId: "vlr:team:11058",
      teamBId: "team-liquid",
      winnerId: "vlr:team:11058",
      maps: [
        { map: { name: "Ascent", raw: "Ascent", recognized: true }, order: 1, teamAScore: 13, teamBScore: 7, winnerInternalTeamId: "vlr:team:11058", overtime: false, qualityFlags: [] },
      ],
      rosterSnapshots: [
        { teamInternalId: "vlr:team:11058", asOf: "2025-06-01T12:00:00.000Z", playerInternalIds: ["vlr:player:1"] },
        { teamInternalId: "team-liquid", asOf: "2025-06-01T12:00:00.000Z", playerInternalIds: ["vlr:player:2"] },
      ],
    });

    const mapping = buildTeamMappingLookup([mappingEntry()]);
    const remapped = remapUnmappedTeamIdentities(match, mapping);

    expect(remapped.teamAId).toBe("g2-esports");
    expect(remapped.teamBId).toBe("team-liquid");
    expect(remapped.winnerId).toBe("g2-esports");
    expect(remapped.maps[0]!.winnerInternalTeamId).toBe("g2-esports");
    expect(remapped.rosterSnapshots![0]!.teamInternalId).toBe("g2-esports");
    expect(remapped.rosterSnapshots![1]!.teamInternalId).toBe("team-liquid");
  });

  it("passes through an id with no matching registry entry unchanged", () => {
    const match = buildNormalizedMatch({ teamAId: "vlr:team:99999", teamBId: "team-liquid", winnerId: "vlr:team:99999" });
    const mapping = buildTeamMappingLookup([mappingEntry()]);
    const remapped = remapUnmappedTeamIdentities(match, mapping);

    expect(remapped.teamAId).toBe("vlr:team:99999");
    expect(remapped.winnerId).toBe("vlr:team:99999");
  });

  it("leaves an already-canonical team id unchanged even if a mapping happens to exist for other ids", () => {
    const match = buildNormalizedMatch({ teamAId: "fnatic", teamBId: "team-liquid" });
    const mapping = buildTeamMappingLookup([mappingEntry()]);
    const remapped = remapUnmappedTeamIdentities(match, mapping);

    expect(remapped.teamAId).toBe("fnatic");
    expect(remapped.teamBId).toBe("team-liquid");
  });

  it("leaves winnerId null when the match has no resolvable winner", () => {
    const match = buildNormalizedMatch({ winnerId: null });
    const mapping = buildTeamMappingLookup([mappingEntry()]);
    const remapped = remapUnmappedTeamIdentities(match, mapping);

    expect(remapped.winnerId).toBeNull();
  });

  it("leaves rosterSnapshots undefined unchanged when the match has none", () => {
    const match = buildNormalizedMatch({ rosterSnapshots: undefined });
    const mapping = buildTeamMappingLookup([mappingEntry()]);
    const remapped = remapUnmappedTeamIdentities(match, mapping);

    expect(remapped.rosterSnapshots).toBeUndefined();
  });
});
