import { describe, expect, it } from "vitest";
import {
  VCT_REGIONS,
  VCT_TEAMS,
  getAllRegions,
  getAllTeams,
  getOpposingTeams,
  getRegionById,
  getTeamById,
  getTeamsByRegion,
  isTeamInRegion,
  type VctRegion,
  type VctTeam,
} from "./vctDirectory";
import { validateVctDirectory } from "./vctDirectory.validate";
import { VCT_REGION_LOGOS, VCT_TEAM_LOGOS } from "./vctLogos";

describe("VCT region/team directory", () => {
  it("has exactly 4 regions", () => {
    expect(VCT_REGIONS).toHaveLength(4);
    expect(VCT_REGIONS.map((region) => region.id).sort()).toEqual(["americas", "china", "emea", "pacific"]);
  });

  it("has exactly 32 teams", () => {
    expect(VCT_TEAMS).toHaveLength(32);
  });

  it("has exactly 8 teams per region", () => {
    for (const region of VCT_REGIONS) {
      const teamsInRegion = VCT_TEAMS.filter((team) => team.region === region.id);
      expect(teamsInRegion).toHaveLength(8);
      expect(region.teamIds).toHaveLength(8);
    }
  });

  it("passes validation with zero issues", () => {
    expect(validateVctDirectory(VCT_REGIONS, VCT_TEAMS)).toEqual([]);
  });

  it("has no duplicate team ids", () => {
    const ids = VCT_TEAMS.map((team) => team.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no duplicate short names", () => {
    const shortNames = VCT_TEAMS.map((team) => team.shortName);
    expect(new Set(shortNames).size).toBe(shortNames.length);
  });

  it("every team logo path is registered in the TASK-029 manifest", () => {
    const manifestPaths = new Set<string>(VCT_TEAM_LOGOS.map((asset) => asset.logoPath));
    for (const team of VCT_TEAMS) {
      expect(manifestPaths.has(team.logoPath)).toBe(true);
    }
  });

  it("every region logo path is registered in the TASK-029 manifest", () => {
    const manifestPaths = new Set<string>(Object.values(VCT_REGION_LOGOS).map((asset) => asset.logoPath));
    for (const region of VCT_REGIONS) {
      expect(manifestPaths.has(region.logoPath)).toBe(true);
    }
  });

  it("is frozen (readonly) at runtime", () => {
    expect(Object.isFrozen(VCT_TEAMS)).toBe(true);
    expect(Object.isFrozen(VCT_REGIONS)).toBe(true);
    expect(Object.isFrozen(VCT_TEAMS[0])).toBe(true);
    expect(Object.isFrozen(VCT_REGIONS[0])).toBe(true);
    expect(Object.isFrozen(VCT_REGIONS[0]?.teamIds)).toBe(true);
  });
});

describe("getAllRegions / getRegionById", () => {
  it("getAllRegions returns the full region list", () => {
    expect(getAllRegions()).toBe(VCT_REGIONS);
  });

  it("getRegionById finds a known region", () => {
    expect(getRegionById("pacific")?.name).toBe("VCT Pacific");
  });

  it("getRegionById returns undefined for an unknown region", () => {
    expect(getRegionById("unknown" as VctRegion["id"])).toBeUndefined();
  });
});

describe("getAllTeams / getTeamById", () => {
  it("getAllTeams returns the full team list", () => {
    expect(getAllTeams()).toBe(VCT_TEAMS);
  });

  it("getTeamById finds a known team", () => {
    expect(getTeamById("paper-rex")?.name).toBe("Paper Rex");
  });

  it("getTeamById returns undefined for an unknown team", () => {
    expect(getTeamById("not-a-real-team" as VctTeam["id"])).toBeUndefined();
  });
});

describe("getTeamsByRegion / isTeamInRegion", () => {
  it("getTeamsByRegion returns only teams from that region", () => {
    const emeaTeams = getTeamsByRegion("emea");
    expect(emeaTeams).toHaveLength(8);
    expect(emeaTeams.every((team) => team.region === "emea")).toBe(true);
  });

  it("isTeamInRegion is true for a matching team/region pair", () => {
    expect(isTeamInRegion("fnatic", "emea")).toBe(true);
  });

  it("isTeamInRegion is false for a mismatched team/region pair", () => {
    expect(isTeamInRegion("fnatic", "americas")).toBe(false);
  });

  it("isTeamInRegion is false for an unknown team", () => {
    expect(isTeamInRegion("not-a-real-team" as VctTeam["id"], "emea")).toBe(false);
  });
});

describe("getOpposingTeams", () => {
  it("excludes exactly the given team", () => {
    const opponents = getOpposingTeams("paper-rex");
    expect(opponents).toHaveLength(31);
    expect(opponents.some((team) => team.id === "paper-rex")).toBe(false);
  });

  it("returns the full roster when the excluded id does not exist", () => {
    expect(getOpposingTeams("not-a-real-team" as VctTeam["id"])).toHaveLength(32);
  });

  it("is deterministic across repeated calls", () => {
    expect(getOpposingTeams("t1")).toEqual(getOpposingTeams("t1"));
  });
});

describe("validateVctDirectory", () => {
  it("flags a team count mismatch", () => {
    const shortTeamList = VCT_TEAMS.slice(0, 31);
    const issues = validateVctDirectory(VCT_REGIONS, shortTeamList);
    expect(issues.some((issue) => issue.code === "team-count-mismatch")).toBe(true);
  });

  it("flags a duplicate team id", () => {
    const firstTeam = VCT_TEAMS[0]!;
    const issues = validateVctDirectory(VCT_REGIONS, [...VCT_TEAMS, firstTeam]);
    expect(issues.some((issue) => issue.code === "duplicate-team-id")).toBe(true);
  });

  it("flags a duplicate short name", () => {
    const firstTeam = VCT_TEAMS[0]!;
    const secondTeam = VCT_TEAMS[1]!;
    const teamsWithClash = VCT_TEAMS.map((team) =>
      team.id === secondTeam.id ? { ...team, shortName: firstTeam.shortName } : team,
    );
    const issues = validateVctDirectory(VCT_REGIONS, teamsWithClash);
    expect(issues.some((issue) => issue.code === "duplicate-short-name")).toBe(true);
  });

  it("flags a team-per-region mismatch when a region loses a team", () => {
    const withoutOneAmericasTeam = VCT_TEAMS.filter((team) => team.id !== "loud");
    const issues = validateVctDirectory(VCT_REGIONS, withoutOneAmericasTeam);
    expect(issues.some((issue) => issue.code === "team-per-region-mismatch")).toBe(true);
  });

  it("flags a region/team id mismatch when teamIds disagree with actual teams", () => {
    const staleRegions: VctRegion[] = VCT_REGIONS.map((region) =>
      region.id === "pacific" ? { ...region, teamIds: ["fnatic"] } : region,
    );
    const issues = validateVctDirectory(staleRegions, VCT_TEAMS);
    expect(issues.some((issue) => issue.code === "region-team-id-mismatch")).toBe(true);
  });

  it("flags an unmanifested logo path", () => {
    const firstTeam = VCT_TEAMS[0]!;
    const teamsWithBadPath = [{ ...firstTeam, logoPath: "/assets/vct/teams/not-real.png" }, ...VCT_TEAMS.slice(1)];
    const issues = validateVctDirectory(VCT_REGIONS, teamsWithBadPath);
    expect(issues.some((issue) => issue.code === "unmanifested-logo-path")).toBe(true);
  });

  it("flags an absolute Windows path", () => {
    const firstTeam = VCT_TEAMS[0]!;
    const teamsWithAbsolutePath = [
      { ...firstTeam, logoPath: "C:\\Users\\PC\\Downloads\\paper-rex.png" },
      ...VCT_TEAMS.slice(1),
    ];
    const issues = validateVctDirectory(VCT_REGIONS, teamsWithAbsolutePath);
    expect(issues.some((issue) => issue.code === "absolute-path")).toBe(true);
  });
});
