import { describe, expect, it } from "vitest";
import { VCT_TEAMS } from "../../constants/vct";
import { VCT_TEAM_PROFILES } from "@repo/prediction-engine";
import type { VctTeamProfile } from "@repo/prediction-engine";
import type { VctTeam } from "../../constants/vct";
import {
  adaptDisclosureForPowerRankings,
  buildPowerRankings,
  compareRankingEntries,
  computeMapDepthScore,
  groupEntriesByRegion,
} from "./rankingModel";

function makeProfile(overrides: Partial<VctTeamProfile>): VctTeamProfile {
  const base = VCT_TEAM_PROFILES[0]!;
  return { ...base, ...overrides };
}

function makeTeam(overrides: Partial<VctTeam>): VctTeam {
  const base = VCT_TEAMS[0]!;
  return { ...base, ...overrides };
}

describe("computeMapDepthScore", () => {
  it("is the exact mean of mapStrength, unrounded", () => {
    const profile = makeProfile({ mapStrength: Object.freeze({ ascent: 40, haven: 50, bind: 60 }) });
    expect(computeMapDepthScore(profile)).toBeCloseTo(50, 10);
  });
});

describe("power score formula", () => {
  it("matches the documented weighted composite exactly", () => {
    const profile = makeProfile({
      overallRating: 80,
      recentFormIndex: 60,
      consistency: 40,
      clutchPerformance: 20,
      mapStrength: Object.freeze({ ascent: 100, haven: 0 }), // mapDepthScore = 50
    });
    const [entry] = buildPowerRankings([makeTeam({ id: profile.teamId })], [profile]);
    // 80*0.35 + 60*0.25 + 50*0.20 + 40*0.15 + 20*0.05 = 28 + 15 + 10 + 6 + 1 = 60
    expect(entry!.powerScore).toBe(60);
  });
});

describe("compareRankingEntries", () => {
  it("sorts by powerScore descending first", () => {
    const a = { team: makeTeam({ id: "team-1" as VctTeam["id"] }), profile: makeProfile({}), powerScore: 70 };
    const b = { team: makeTeam({ id: "team-2" as VctTeam["id"] }), profile: makeProfile({}), powerScore: 80 };
    expect(compareRankingEntries(a, b)).toBeGreaterThan(0);
    expect(compareRankingEntries(b, a)).toBeLessThan(0);
  });

  it("falls back to overallRating descending when powerScore ties", () => {
    const a = {
      team: makeTeam({ id: "team-1" as VctTeam["id"] }),
      profile: makeProfile({ overallRating: 60 }),
      powerScore: 70,
    };
    const b = {
      team: makeTeam({ id: "team-2" as VctTeam["id"] }),
      profile: makeProfile({ overallRating: 75 }),
      powerScore: 70,
    };
    expect(compareRankingEntries(a, b)).toBeGreaterThan(0);
    expect(compareRankingEntries(b, a)).toBeLessThan(0);
  });

  it("falls back to teamId ascending as the final decisive tie-break", () => {
    const a = {
      team: makeTeam({ id: "team-b" as VctTeam["id"] }),
      profile: makeProfile({ overallRating: 60 }),
      powerScore: 70,
    };
    const b = {
      team: makeTeam({ id: "team-a" as VctTeam["id"] }),
      profile: makeProfile({ overallRating: 60 }),
      powerScore: 70,
    };
    expect(compareRankingEntries(a, b)).toBeGreaterThan(0);
    expect(compareRankingEntries(b, a)).toBeLessThan(0);
    expect(compareRankingEntries(a, a)).toBe(0);
  });
});

describe("buildPowerRankings", () => {
  it("is deterministic: calling it twice produces identical results", () => {
    const first = buildPowerRankings(VCT_TEAMS, VCT_TEAM_PROFILES);
    const second = buildPowerRankings(VCT_TEAMS, VCT_TEAM_PROFILES);
    expect(second).toEqual(first);
  });

  it("assigns globalRank 1..32 with no gaps or duplicates for the full roster", () => {
    const entries = buildPowerRankings(VCT_TEAMS, VCT_TEAM_PROFILES);
    expect(entries).toHaveLength(32);
    const globalRanks = entries.map((entry) => entry.globalRank).sort((a, b) => a - b);
    expect(globalRanks).toEqual(Array.from({ length: 32 }, (_, index) => index + 1));
  });

  it("assigns regionalRank 1..8 within every region, as a subsequence of the global order", () => {
    const entries = buildPowerRankings(VCT_TEAMS, VCT_TEAM_PROFILES);
    const byRegion = groupEntriesByRegion(entries);

    for (const region of Object.keys(byRegion) as (keyof typeof byRegion)[]) {
      const regionEntries = byRegion[region];
      expect(regionEntries).toHaveLength(8);

      const regionalRanks = regionEntries.map((entry) => entry.regionalRank).sort((a, b) => a - b);
      expect(regionalRanks).toEqual(Array.from({ length: 8 }, (_, index) => index + 1));

      // Subsequence guarantee: within-region order must match each entry's
      // position among just that region's entries, filtered from the
      // already-sorted global list (never independently re-sorted).
      regionEntries.forEach((entry, index) => {
        expect(entry.regionalRank).toBe(index + 1);
      });
    }
  });

  it("skips a team with no matching profile instead of throwing", () => {
    const orphanTeam = makeTeam({ id: "no-profile-team" as VctTeam["id"] });
    const entries = buildPowerRankings([orphanTeam, ...VCT_TEAMS], VCT_TEAM_PROFILES);
    expect(entries.some((entry) => entry.team.id === orphanTeam.id)).toBe(false);
    expect(entries).toHaveLength(32);
  });
});

describe("adaptDisclosureForPowerRankings", () => {
  it("swaps the leading verb phrase and keeps the rest of the sentence verbatim", () => {
    const disclosure =
      "Predictions use simulated team profiles for demonstration purposes. Values are modeled estimates, not real statistics from Riot Games or any tournament.";
    expect(adaptDisclosureForPowerRankings(disclosure)).toBe(
      "These rankings use simulated team profiles for demonstration purposes. Values are modeled estimates, not real statistics from Riot Games or any tournament.",
    );
  });

  it("leaves unrelated text untouched", () => {
    expect(adaptDisclosureForPowerRankings("Some other sentence.")).toBe("Some other sentence.");
  });
});
