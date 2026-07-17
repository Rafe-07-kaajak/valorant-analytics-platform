import { describe, expect, it } from "vitest";
import { compareMaps, largestGapMap, mostEvenMap, strongestMap, weakestMap } from "./maps";
import { buildProfileFixture } from "./testFixtures";

const MAPS = [
  { id: "ascent", name: "Ascent" },
  { id: "bind", name: "Bind" },
  { id: "haven", name: "Haven" },
  { id: "lotus", name: "Lotus" },
  { id: "pearl", name: "Pearl" },
  { id: "split", name: "Split" },
  { id: "sunset", name: "Sunset" },
  { id: "icebox", name: "Icebox" },
];

describe("strongestMap / weakestMap", () => {
  it("finds the highest and lowest scoring map", () => {
    const profile = buildProfileFixture({
      mapStrength: { ascent: 40, bind: 90, haven: 55 },
    });
    expect(strongestMap(profile, MAPS)).toEqual({ mapId: "bind", mapName: "Bind", score: 90 });
    expect(weakestMap(profile, MAPS)).toEqual({ mapId: "ascent", mapName: "Ascent", score: 40 });
  });

  it("falls back to the raw map id when no display name is found", () => {
    const profile = buildProfileFixture({ mapStrength: { "unlisted-map": 50 } });
    expect(strongestMap(profile, MAPS)?.mapName).toBe("unlisted-map");
  });

  it("returns null for an empty mapStrength record instead of crashing", () => {
    const profile = buildProfileFixture({ mapStrength: {} });
    expect(strongestMap(profile, MAPS)).toBeNull();
    expect(weakestMap(profile, MAPS)).toBeNull();
  });
});

describe("compareMaps", () => {
  it("produces one row per map present in both profiles", () => {
    const rows = compareMaps(buildProfileFixture(), buildProfileFixture(), MAPS);
    expect(rows).toHaveLength(MAPS.length);
    expect(rows.map((row) => row.mapId)).toEqual(MAPS.map((map) => map.id));
  });

  it("excludes maps missing from either profile rather than producing NaN rows", () => {
    const profileA = buildProfileFixture({ mapStrength: { ascent: 70, bind: 60 } });
    const profileB = buildProfileFixture({ mapStrength: { ascent: 65 } });
    const rows = compareMaps(profileA, profileB, MAPS);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.mapId).toBe("ascent");
  });

  it("is deterministic", () => {
    const profileA = buildProfileFixture();
    const profileB = buildProfileFixture({ overallRating: 55 });
    expect(compareMaps(profileA, profileB, MAPS)).toEqual(compareMaps(profileA, profileB, MAPS));
  });
});

describe("mostEvenMap / largestGapMap", () => {
  const profileA = buildProfileFixture({
    mapStrength: { ascent: 70, bind: 50, haven: 60 },
  });
  const profileB = buildProfileFixture({
    mapStrength: { ascent: 71, bind: 80, haven: 40 },
  });
  const rows = compareMaps(profileA, profileB, MAPS);

  it("finds the smallest-gap row", () => {
    expect(mostEvenMap(rows)?.mapId).toBe("ascent");
  });

  it("finds the largest-gap row", () => {
    expect(largestGapMap(rows)?.mapId).toBe("bind");
  });

  it("returns null for an empty row list", () => {
    expect(mostEvenMap([])).toBeNull();
    expect(largestGapMap([])).toBeNull();
  });
});
