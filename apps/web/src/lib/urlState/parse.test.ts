import { describe, expect, it } from "vitest";
import { parseUrlState } from "./parse";

const VALID_MAP_IDS = new Set(["ascent", "haven", "bind", "lotus", "pearl", "split", "sunset", "icebox"]);

function parse(query: string) {
  return parseUrlState(new URLSearchParams(query), { validMapIds: VALID_MAP_IDS });
}

describe("parseUrlState", () => {
  it("parses a fully valid canonical URL", () => {
    expect(parse("regionA=pacific&teamA=paper-rex&regionB=americas&teamB=g2-esports&maps=ascent,haven,bind&format=BO3")).toEqual({
      regionA: "pacific",
      teamA: "paper-rex",
      regionB: "americas",
      teamB: "g2-esports",
      maps: ["ascent", "haven", "bind"],
      format: "BO3",
      mode: null,
    });
  });

  it("returns the empty canonical state for an empty query", () => {
    expect(parse("")).toEqual({ regionA: null, teamA: null, regionB: null, teamB: null, maps: [], format: null, mode: null });
  });

  it("parses a valid mode", () => {
    expect(parse("mode=real").mode).toBe("real");
    expect(parse("mode=synthetic").mode).toBe("synthetic");
  });

  it("drops an invalid mode to null rather than crashing", () => {
    expect(parse("mode=not-a-mode").mode).toBeNull();
  });

  it("defaults mode to null when absent", () => {
    expect(parse("teamA=paper-rex").mode).toBeNull();
  });

  it("ignores an unknown team id entirely", () => {
    const state = parse("teamA=not-a-real-team");
    expect(state.teamA).toBeNull();
    expect(state.regionA).toBeNull();
  });

  it("infers the region from a valid team when the region param is missing", () => {
    const state = parse("teamA=paper-rex");
    expect(state.teamA).toBe("paper-rex");
    expect(state.regionA).toBe("pacific");
  });

  it("repairs an invalid region when the team is valid", () => {
    const state = parse("regionA=mars&teamA=paper-rex");
    expect(state.regionA).toBe("pacific");
  });

  it("repairs a mismatched region to the team's real region, deterministically preferring the team", () => {
    // regionA says EMEA but paper-rex is actually Pacific — the team wins.
    const state = parse("regionA=emea&teamA=paper-rex");
    expect(state.regionA).toBe("pacific");
    expect(state.teamA).toBe("paper-rex");
  });

  it("keeps a valid region when no team is present, to preload that region's team grid", () => {
    const state = parse("regionA=pacific");
    expect(state.regionA).toBe("pacific");
    expect(state.teamA).toBeNull();
  });

  it("clears an invalid region when no team is present", () => {
    const state = parse("regionA=mars");
    expect(state.regionA).toBeNull();
  });

  it("keeps Team A and clears Team B when the same team is requested for both sides", () => {
    const state = parse("teamA=paper-rex&teamB=paper-rex");
    expect(state.teamA).toBe("paper-rex");
    expect(state.teamB).toBeNull();
  });

  it("deduplicates maps", () => {
    const state = parse("maps=ascent,ascent,haven");
    expect(state.maps).toEqual(["ascent", "haven"]);
  });

  it("removes invalid maps", () => {
    const state = parse("maps=ascent,bogus,haven");
    expect(state.maps).toEqual(["ascent", "haven"]);
  });

  it("treats an empty maps parameter as zero selected maps", () => {
    expect(parse("maps=").maps).toEqual([]);
    expect(parse("").maps).toEqual([]);
  });

  it("falls back safely for an unsupported format", () => {
    const state = parse("format=BO7");
    expect(state.format).toBeNull();
  });

  it("accepts a valid format", () => {
    expect(parse("format=BO5").format).toBe("BO5");
  });

  it("caps maps to the format's series limit when a valid format is present", () => {
    const state = parse("format=BO3&maps=ascent,haven,bind,lotus,pearl");
    expect(state.maps).toEqual(["ascent", "haven", "bind"]);
  });

  it("does not cap maps when format is absent or invalid", () => {
    const state = parse("maps=ascent,haven,bind,lotus,pearl,split,sunset,icebox");
    expect(state.maps).toHaveLength(8);
  });

  it("never crashes on excessively long or malformed input", () => {
    const huge = "a".repeat(10_000);
    expect(() => parse(`teamA=${huge}&regionA=${huge}&maps=${huge}&format=${huge}`)).not.toThrow();
    const state = parse(`teamA=${huge}`);
    expect(state.teamA).toBeNull();
  });

  it("ignores parameters outside the canonical contract without affecting parsed state", () => {
    const state = parse("teamA=paper-rex&utm_source=twitter&debug=1");
    expect(state.teamA).toBe("paper-rex");
  });

  it("round-trips: parsing the output of a full valid state change reproduces the same state", () => {
    const original = parse("regionA=pacific&teamA=paper-rex&regionB=americas&teamB=g2-esports&maps=ascent,haven&format=BO3");
    const roundTripped = parse(
      `regionA=${original.regionA}&teamA=${original.teamA}&regionB=${original.regionB}&teamB=${original.teamB}&maps=${original.maps.join(",")}&format=${original.format}`,
    );
    expect(roundTripped).toEqual(original);
  });
});
