import { describe, expect, it } from "vitest";
import { VCT_TEAM_PROFILES, type VctTeamProfile } from "./vctTeamProfiles";
import { validateVctTeamProfiles } from "./validateVctTeamProfiles";

describe("validateVctTeamProfiles", () => {
  it("passes with zero issues against the real 32-team profile set", () => {
    expect(validateVctTeamProfiles(VCT_TEAM_PROFILES)).toEqual([]);
  });

  it("flags a profile count mismatch", () => {
    const issues = validateVctTeamProfiles(VCT_TEAM_PROFILES.slice(0, 31));
    expect(issues.some((issue) => issue.code === "profile-count-mismatch")).toBe(true);
  });

  it("flags a missing team", () => {
    const withoutOne = VCT_TEAM_PROFILES.filter((profile) => profile.teamId !== "t1");
    const issues = validateVctTeamProfiles(withoutOne);
    expect(issues.some((issue) => issue.code === "missing-team")).toBe(true);
  });

  it("flags a duplicate team id", () => {
    const firstProfile = VCT_TEAM_PROFILES[0]!;
    const issues = validateVctTeamProfiles([...VCT_TEAM_PROFILES, firstProfile]);
    expect(issues.some((issue) => issue.code === "duplicate-team-id")).toBe(true);
  });

  it("flags an out-of-bounds percent field", () => {
    const firstProfile = VCT_TEAM_PROFILES[0]!;
    const tampered: VctTeamProfile[] = [
      { ...firstProfile, overallRating: 150 },
      ...VCT_TEAM_PROFILES.slice(1),
    ];
    const issues = validateVctTeamProfiles(tampered);
    expect(issues.some((issue) => issue.code === "invalid-percent")).toBe(true);
  });

  it("flags a NaN percent field", () => {
    const firstProfile = VCT_TEAM_PROFILES[0]!;
    const tampered: VctTeamProfile[] = [
      { ...firstProfile, attackStrength: Number.NaN },
      ...VCT_TEAM_PROFILES.slice(1),
    ];
    const issues = validateVctTeamProfiles(tampered);
    expect(issues.some((issue) => issue.code === "invalid-percent")).toBe(true);
  });

  it("flags an out-of-bounds round differential", () => {
    const firstProfile = VCT_TEAM_PROFILES[0]!;
    const tampered: VctTeamProfile[] = [
      { ...firstProfile, roundDifferential: 42 },
      ...VCT_TEAM_PROFILES.slice(1),
    ];
    const issues = validateVctTeamProfiles(tampered);
    expect(issues.some((issue) => issue.code === "invalid-round-differential")).toBe(true);
  });

  it("flags a missing map on a profile", () => {
    const firstProfile = VCT_TEAM_PROFILES[0]!;
    const remainingMaps = { ...firstProfile.mapStrength };
    delete (remainingMaps as Partial<typeof remainingMaps>).ascent;
    const tampered: VctTeamProfile[] = [
      { ...firstProfile, mapStrength: remainingMaps },
      ...VCT_TEAM_PROFILES.slice(1),
    ];
    const issues = validateVctTeamProfiles(tampered);
    expect(issues.some((issue) => issue.code === "missing-map")).toBe(true);
  });

  it("flags an unknown map id on a profile", () => {
    const firstProfile = VCT_TEAM_PROFILES[0]!;
    const tampered: VctTeamProfile[] = [
      { ...firstProfile, mapStrength: { ...firstProfile.mapStrength, "not-a-real-map": 50 } },
      ...VCT_TEAM_PROFILES.slice(1),
    ];
    const issues = validateVctTeamProfiles(tampered);
    expect(issues.some((issue) => issue.code === "unknown-map-id")).toBe(true);
  });

  it("flags a DNA dimension count mismatch", () => {
    const firstProfile = VCT_TEAM_PROFILES[0]!;
    const tampered: VctTeamProfile[] = [
      { ...firstProfile, dna: { ...firstProfile.dna, dimensions: firstProfile.dna.dimensions.slice(0, 3) } },
      ...VCT_TEAM_PROFILES.slice(1),
    ];
    const issues = validateVctTeamProfiles(tampered);
    expect(issues.some((issue) => issue.code === "dna-dimension-count-mismatch")).toBe(true);
  });

  it("flags a DNA/profile team id mismatch", () => {
    const firstProfile = VCT_TEAM_PROFILES[0]!;
    const tampered: VctTeamProfile[] = [
      { ...firstProfile, dna: { ...firstProfile.dna, teamId: "not-a-real-team" } },
      ...VCT_TEAM_PROFILES.slice(1),
    ];
    const issues = validateVctTeamProfiles(tampered);
    expect(issues.some((issue) => issue.code === "dna-team-id-mismatch")).toBe(true);
  });

  it("flags a manually altered (non-deterministic) profile set", () => {
    const firstProfile = VCT_TEAM_PROFILES[0]!;
    const tampered: VctTeamProfile[] = [
      { ...firstProfile, overallRating: 1 },
      ...VCT_TEAM_PROFILES.slice(1),
    ];
    const issues = validateVctTeamProfiles(tampered);
    expect(issues.some((issue) => issue.code === "non-deterministic-generation")).toBe(true);
  });
});
