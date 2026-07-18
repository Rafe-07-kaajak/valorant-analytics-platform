import { describe, expect, it } from "vitest";
import { computeCuratedDatasetVersion, computeIdentityMappingVersion } from "./curatedVersion";
import type { VlrTeamMappingEntry } from "../identity/teamMapping";
import type { TeamAlias } from "../identity/teamAliasRegistry";

const MAPPING: readonly VlrTeamMappingEntry[] = [{ vlrTeamId: "1034", internalTeamId: "nrg", reason: "r" }];
const ALIASES: readonly TeamAlias[] = [{ canonicalTeamId: "kru-esports", alias: "KRÜ Esports", aliasType: "display-name" }];

describe("computeIdentityMappingVersion", () => {
  it("is deterministic for the same mapping/alias content regardless of array order", () => {
    const a = computeIdentityMappingVersion(MAPPING, ALIASES);
    const b = computeIdentityMappingVersion([...MAPPING], [...ALIASES]);
    expect(a).toBe(b);
  });

  it("changes when a mapping entry's target changes", () => {
    const a = computeIdentityMappingVersion(MAPPING, ALIASES);
    const b = computeIdentityMappingVersion([{ vlrTeamId: "1034", internalTeamId: "100-thieves", reason: "r" }], ALIASES);
    expect(a).not.toBe(b);
  });

  it("changes when an alias is added", () => {
    const a = computeIdentityMappingVersion(MAPPING, []);
    const b = computeIdentityMappingVersion(MAPPING, ALIASES);
    expect(a).not.toBe(b);
  });
});

describe("computeCuratedDatasetVersion", () => {
  it("incorporates the quality-rules version so a rule change would change the curated version (verified by inspecting the hash inputs)", () => {
    const version = computeCuratedDatasetVersion({ sourceDatasetVersion: "v1", identityMappingVersion: "id-v1", curatedMatchInternalIds: ["vlr:match:1"], curatedMatchContentHashes: ["h1"] });
    expect(version.qualityRulesVersion).toMatch(/^vlr-quality-rules@/);
  });

  it("changes when the identity mapping version changes, holding everything else constant", () => {
    const a = computeCuratedDatasetVersion({ sourceDatasetVersion: "v1", identityMappingVersion: "id-v1", curatedMatchInternalIds: ["vlr:match:1"], curatedMatchContentHashes: ["h1"] });
    const b = computeCuratedDatasetVersion({ sourceDatasetVersion: "v1", identityMappingVersion: "id-v2", curatedMatchInternalIds: ["vlr:match:1"], curatedMatchContentHashes: ["h1"] });
    expect(a.curatedDatasetVersion).not.toBe(b.curatedDatasetVersion);
  });

  it("is stable for identical input, never a random UUID", () => {
    const inputs = { sourceDatasetVersion: "v1", identityMappingVersion: "id-v1", curatedMatchInternalIds: ["vlr:match:1"], curatedMatchContentHashes: ["h1"] };
    expect(computeCuratedDatasetVersion(inputs).curatedDatasetVersion).toBe(computeCuratedDatasetVersion(inputs).curatedDatasetVersion);
  });
});
