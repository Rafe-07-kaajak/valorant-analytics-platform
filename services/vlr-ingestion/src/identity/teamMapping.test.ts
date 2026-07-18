import { describe, expect, it } from "vitest";
import {
  buildTeamMappingLookup,
  findAliasCandidates,
  resolveTeamIdentity,
  validateTeamMappingRegistry,
} from "./teamMapping";
import type { VlrTeamMappingEntry } from "./teamMapping";

const FNATIC_ENTRY: VlrTeamMappingEntry = {
  vlrTeamId: "2593",
  internalTeamId: "fnatic",
  aliases: ["Fnatic", "FNC"],
  reason: "Verified against a fixture-captured VLR team page.",
};

describe("validateTeamMappingRegistry", () => {
  it("accepts a well-formed registry", () => {
    const result = validateTeamMappingRegistry([FNATIC_ENTRY]);
    expect(result.valid).toBe(true);
    expect(result.conflicts).toHaveLength(0);
  });

  it("rejects an entry with an unknown internalTeamId", () => {
    const result = validateTeamMappingRegistry([{ ...FNATIC_ENTRY, internalTeamId: "not-a-real-team" as never }]);
    expect(result.valid).toBe(false);
    expect(result.invalidEntries).toHaveLength(1);
  });

  it("rejects an entry with an empty vlrTeamId", () => {
    const result = validateTeamMappingRegistry([{ ...FNATIC_ENTRY, vlrTeamId: "" }]);
    expect(result.valid).toBe(false);
  });

  it("rejects an entry missing a reason", () => {
    const result = validateTeamMappingRegistry([{ ...FNATIC_ENTRY, reason: "" }]);
    expect(result.valid).toBe(false);
  });

  it("detects conflicting mappings for the same VLR team ID", () => {
    const result = validateTeamMappingRegistry([FNATIC_ENTRY, { ...FNATIC_ENTRY, internalTeamId: "team-liquid" }]);
    expect(result.valid).toBe(false);
    expect(result.conflicts).toHaveLength(1);
  });
});

describe("resolveTeamIdentity", () => {
  it("resolves a mapped VLR team ID to its internal VctTeamId", () => {
    const lookup = buildTeamMappingLookup([FNATIC_ENTRY]);
    const resolved = resolveTeamIdentity("2593", lookup);
    expect(resolved).toEqual({ internalId: "fnatic", mapped: true });
  });

  it("returns a valid deterministic external identity for an unmapped team, never a rejection", () => {
    const lookup = buildTeamMappingLookup([FNATIC_ENTRY]);
    const resolved = resolveTeamIdentity("9999", lookup);
    expect(resolved.mapped).toBe(false);
    expect(resolved.internalId).toBe("vlr:team:9999");
  });
});

describe("findAliasCandidates", () => {
  it("suggests entries matching an alias without resolving anything", () => {
    const candidates = findAliasCandidates("FNC", [FNATIC_ENTRY]);
    expect(candidates).toEqual([FNATIC_ENTRY]);
  });

  it("is case-insensitive and trims whitespace", () => {
    const candidates = findAliasCandidates("  fnatic  ", [FNATIC_ENTRY]);
    expect(candidates).toEqual([FNATIC_ENTRY]);
  });

  it("returns no candidates for an unrelated display name", () => {
    expect(findAliasCandidates("Totally Unrelated Org", [FNATIC_ENTRY])).toHaveLength(0);
  });
});
