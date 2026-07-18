import { describe, expect, it } from "vitest";
import { isValidSeriesWinCount, normalizeSeriesFormat } from "./seriesFormat";

describe("normalizeSeriesFormat", () => {
  it("normalizes BO1/BO3/BO5 in varied casing and spacing", () => {
    expect(normalizeSeriesFormat("Bo3")).toBe("bo3");
    expect(normalizeSeriesFormat("BO 5")).toBe("bo5");
    expect(normalizeSeriesFormat("bo1")).toBe("bo1");
  });

  it("normalizes a 'Best of N' phrasing", () => {
    expect(normalizeSeriesFormat("Best of 3")).toBe("bo3");
  });

  it("returns unknown for an unrecognized or missing format", () => {
    expect(normalizeSeriesFormat("Round Robin")).toBe("unknown");
    expect(normalizeSeriesFormat(undefined)).toBe("unknown");
  });
});

describe("isValidSeriesWinCount", () => {
  it("validates a Bo3 winner needs exactly 2 map wins", () => {
    expect(isValidSeriesWinCount("bo3", 2)).toBe(true);
    expect(isValidSeriesWinCount("bo3", 1)).toBe(false);
    expect(isValidSeriesWinCount("bo3", 3)).toBe(false);
  });

  it("validates a Bo5 winner needs exactly 3 map wins", () => {
    expect(isValidSeriesWinCount("bo5", 3)).toBe(true);
    expect(isValidSeriesWinCount("bo5", 2)).toBe(false);
  });

  it("accepts any positive win count for an unknown format", () => {
    expect(isValidSeriesWinCount("unknown", 1)).toBe(true);
    expect(isValidSeriesWinCount("unknown", 0)).toBe(false);
  });
});
