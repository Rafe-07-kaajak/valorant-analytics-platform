import { describe, expect, it } from "vitest";
import { isValidRegionId, isValidSeriesFormat, isValidTeamId, regionForTeam } from "./validation";

describe("isValidTeamId", () => {
  it("accepts a known team id", () => {
    expect(isValidTeamId("paper-rex")).toBe(true);
  });

  it("rejects an unknown team id", () => {
    expect(isValidTeamId("not-a-real-team")).toBe(false);
  });

  it("rejects null", () => {
    expect(isValidTeamId(null)).toBe(false);
  });

  it("rejects an excessively long value", () => {
    expect(isValidTeamId("a".repeat(500))).toBe(false);
  });
});

describe("isValidRegionId", () => {
  it("accepts a known region id", () => {
    expect(isValidRegionId("pacific")).toBe(true);
  });

  it("rejects an unknown region id", () => {
    expect(isValidRegionId("mars")).toBe(false);
  });

  it("rejects null", () => {
    expect(isValidRegionId(null)).toBe(false);
  });
});

describe("isValidSeriesFormat", () => {
  it("accepts BO3 and BO5", () => {
    expect(isValidSeriesFormat("BO3")).toBe(true);
    expect(isValidSeriesFormat("BO5")).toBe(true);
  });

  it("rejects an unsupported format", () => {
    expect(isValidSeriesFormat("BO7")).toBe(false);
    expect(isValidSeriesFormat("bo3")).toBe(false);
  });

  it("rejects null", () => {
    expect(isValidSeriesFormat(null)).toBe(false);
  });
});

describe("regionForTeam", () => {
  it("returns the team's real region", () => {
    expect(regionForTeam("paper-rex")).toBe("pacific");
    expect(regionForTeam("g2-esports")).toBe("americas");
  });
});
