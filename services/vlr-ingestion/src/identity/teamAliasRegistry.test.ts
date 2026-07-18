import { describe, expect, it } from "vitest";
import { findCanonicalTeamsForAlias, normalizeAliasText, validateTeamAliasRegistry } from "./teamAliasRegistry";
import type { TeamAlias } from "./teamAliasRegistry";

const FNATIC_ALIAS: TeamAlias = { canonicalTeamId: "fnatic", alias: "FNC", aliasType: "abbreviation" };

describe("normalizeAliasText", () => {
  it("folds case, punctuation, and diacritics for diagnostic comparison", () => {
    expect(normalizeAliasText("KRÜ Esports")).toBe(normalizeAliasText("KRU Esports"));
    expect(normalizeAliasText("  Fnatic  ")).toBe("fnatic");
    expect(normalizeAliasText("100 Thieves")).toBe("100 thieves");
  });
});

describe("validateTeamAliasRegistry", () => {
  it("accepts a well-formed registry with no collisions", () => {
    const result = validateTeamAliasRegistry([FNATIC_ALIAS]);
    expect(result.valid).toBe(true);
    expect(result.collisions).toHaveLength(0);
  });

  it("rejects an entry with an empty alias", () => {
    const result = validateTeamAliasRegistry([{ ...FNATIC_ALIAS, alias: "" }]);
    expect(result.valid).toBe(false);
  });

  it("detects a collision when the same normalized alias is assigned to two different canonical teams", () => {
    const result = validateTeamAliasRegistry([FNATIC_ALIAS, { canonicalTeamId: "team-liquid", alias: "fnc", aliasType: "abbreviation" }]);
    expect(result.valid).toBe(false);
    expect(result.collisions).toHaveLength(1);
    expect(result.collisions[0]!.conflicting).toHaveLength(2);
  });

  it("does not flag two aliases for the same canonical team as a collision", () => {
    const result = validateTeamAliasRegistry([FNATIC_ALIAS, { canonicalTeamId: "fnatic", alias: "Fnatic VCT", aliasType: "display-name" }]);
    expect(result.valid).toBe(true);
  });
});

describe("findCanonicalTeamsForAlias", () => {
  it("finds a case/whitespace-insensitive match", () => {
    expect(findCanonicalTeamsForAlias("  fnc  ", [FNATIC_ALIAS])).toEqual([FNATIC_ALIAS]);
  });

  it("returns no candidates for an unrelated name", () => {
    expect(findCanonicalTeamsForAlias("Totally Unrelated", [FNATIC_ALIAS])).toHaveLength(0);
  });
});
