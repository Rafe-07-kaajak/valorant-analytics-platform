import { describe, expect, it } from "vitest";
import { parseMapIdsParam, sortMapIdsCanonically } from "./mapIds";

const VALID_MAP_IDS = new Set(["ascent", "haven", "bind", "lotus", "pearl", "split", "sunset", "icebox"]);

describe("parseMapIdsParam", () => {
  it("parses a valid comma-separated list", () => {
    expect(parseMapIdsParam("ascent,haven,bind", VALID_MAP_IDS)).toEqual(["ascent", "haven", "bind"]);
  });

  it("returns an empty array for null", () => {
    expect(parseMapIdsParam(null, VALID_MAP_IDS)).toEqual([]);
  });

  it("returns an empty array for an empty string", () => {
    expect(parseMapIdsParam("", VALID_MAP_IDS)).toEqual([]);
  });

  it("deduplicates repeated ids", () => {
    expect(parseMapIdsParam("ascent,ascent,haven", VALID_MAP_IDS)).toEqual(["ascent", "haven"]);
  });

  it("drops invalid map ids", () => {
    expect(parseMapIdsParam("ascent,not-a-map,haven", VALID_MAP_IDS)).toEqual(["ascent", "haven"]);
  });

  it("orders output canonically (validMapIds order), not by input order", () => {
    expect(parseMapIdsParam("bind,ascent,haven", VALID_MAP_IDS)).toEqual(["ascent", "haven", "bind"]);
  });

  it("trims whitespace and lowercases", () => {
    expect(parseMapIdsParam(" Ascent , HAVEN ", VALID_MAP_IDS)).toEqual(["ascent", "haven"]);
  });

  it("caps excessive raw token counts before validating", () => {
    const excessive = Array.from({ length: 5000 }, (_, i) => `bogus-${i}`).join(",");
    // Should not hang or throw, and should produce no valid maps.
    expect(parseMapIdsParam(excessive, VALID_MAP_IDS)).toEqual([]);
  });

  it("still finds a valid map even amid a very large invalid token list, within the cap", () => {
    const tokens = ["ascent", ...Array.from({ length: 200 }, (_, i) => `bogus-${i}`)];
    expect(parseMapIdsParam(tokens.join(","), VALID_MAP_IDS)).toEqual(["ascent"]);
  });

  it("treats an empty maps parameter as zero selected maps", () => {
    expect(parseMapIdsParam(",,,", VALID_MAP_IDS)).toEqual([]);
  });
});

describe("sortMapIdsCanonically", () => {
  it("produces deterministic, stable output regardless of input order", () => {
    expect(sortMapIdsCanonically(["icebox", "ascent"], VALID_MAP_IDS)).toEqual(["ascent", "icebox"]);
    expect(sortMapIdsCanonically(["ascent", "icebox"], VALID_MAP_IDS)).toEqual(["ascent", "icebox"]);
  });

  it("ignores ids not present in validMapIds", () => {
    expect(sortMapIdsCanonically(["ascent", "made-up"], VALID_MAP_IDS)).toEqual(["ascent"]);
  });
});
