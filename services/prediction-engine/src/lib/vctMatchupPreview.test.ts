import { describe, expect, it } from "vitest";
import { VCT_TEAM_IDENTITIES, type VctTeamId } from "../data/vctTeams";
import { previewVctMatchup } from "./vctMatchupPreview";

const ALL_TEAM_IDS = VCT_TEAM_IDENTITIES.map((identity) => identity.id);

function allUniquePairs(teamIds: readonly VctTeamId[]): [VctTeamId, VctTeamId][] {
  const pairs: [VctTeamId, VctTeamId][] = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      pairs.push([teamIds[i]!, teamIds[j]!]);
    }
  }
  return pairs;
}

describe("previewVctMatchup", () => {
  it("rejects a team matched against itself", () => {
    expect(() => previewVctMatchup("paper-rex", "paper-rex")).toThrow();
  });

  it("rejects an unknown team id", () => {
    expect(() => previewVctMatchup("paper-rex", "not-a-real-team" as VctTeamId)).toThrow();
  });

  it("is deterministic for the same pairing", () => {
    expect(previewVctMatchup("paper-rex", "fnatic")).toEqual(previewVctMatchup("paper-rex", "fnatic"));
  });

  it("produces an inverse-signed weighted advantage when the pairing is reversed", () => {
    const forward = previewVctMatchup("paper-rex", "fnatic");
    const reversed = previewVctMatchup("fnatic", "paper-rex");
    expect(reversed.weightedAdvantage).toBeCloseTo(-forward.weightedAdvantage, 9);
  });

  it("produces finite values for representative cross-region matchups", () => {
    const representativePairs: [VctTeamId, VctTeamId][] = [
      ["paper-rex", "loud"], // pacific vs americas
      ["fnatic", "edward-gaming"], // emea vs china
      ["t1", "team-liquid"], // pacific vs emea
      ["100-thieves", "tyloo"], // americas vs china
    ];

    for (const [teamAId, teamBId] of representativePairs) {
      const preview = previewVctMatchup(teamAId, teamBId);
      expect(Number.isFinite(preview.weightedAdvantage)).toBe(true);
      expect(Number.isFinite(preview.dimensionAgreement)).toBe(true);
      expect(Number.isFinite(preview.matchDna.similarityScore)).toBe(true);
      expect(preview.matchDna.similarityScore).toBeGreaterThanOrEqual(0);
      expect(preview.matchDna.similarityScore).toBeLessThanOrEqual(100);
    }
  });

  it("lets all 32 teams participate in every possible pairing without error", () => {
    const pairs = allUniquePairs(ALL_TEAM_IDS);
    expect(pairs).toHaveLength((32 * 31) / 2);

    for (const [teamAId, teamBId] of pairs) {
      const preview = previewVctMatchup(teamAId, teamBId);
      expect(Number.isFinite(preview.weightedAdvantage)).toBe(true);
      expect(Number.isFinite(preview.dimensionAgreement)).toBe(true);
      expect(preview.dimensionAgreement).toBeGreaterThanOrEqual(0);
      expect(preview.dimensionAgreement).toBeLessThanOrEqual(1);
      expect(Number.isFinite(preview.matchDna.similarityScore)).toBe(true);
    }
  });
});
