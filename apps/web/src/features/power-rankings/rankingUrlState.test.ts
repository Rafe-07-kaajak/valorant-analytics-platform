import { describe, expect, it } from "vitest";
import {
  EMPTY_POWER_RANKINGS_URL_STATE,
  parsePowerRankingsUrlState,
  serializePowerRankingsUrlState,
  withMode,
  withRegion,
  withTeam,
} from "./rankingUrlState";

function params(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

describe("parsePowerRankingsUrlState", () => {
  it("defaults to global mode with no region/team when the query string is empty", () => {
    expect(parsePowerRankingsUrlState(params(""))).toEqual(EMPTY_POWER_RANKINGS_URL_STATE);
  });

  it("parses a valid regional mode with a valid region", () => {
    expect(parsePowerRankingsUrlState(params("mode=regional&region=pacific"))).toEqual({
      mode: "regional",
      region: "pacific",
      team: null,
    });
  });

  it("collapses mode=regional with no valid region back to global rather than guessing a region", () => {
    expect(parsePowerRankingsUrlState(params("mode=regional"))).toEqual({
      mode: "global",
      region: null,
      team: null,
    });
    expect(parsePowerRankingsUrlState(params("mode=regional&region=not-a-region"))).toEqual({
      mode: "global",
      region: null,
      team: null,
    });
  });

  it("drops an unknown region even in global mode", () => {
    expect(parsePowerRankingsUrlState(params("region=not-a-region"))).toEqual(EMPTY_POWER_RANKINGS_URL_STATE);
  });

  it("drops an unknown team id", () => {
    expect(parsePowerRankingsUrlState(params("team=not-a-team"))).toEqual(EMPTY_POWER_RANKINGS_URL_STATE);
  });

  it("accepts a valid team id deep link", () => {
    expect(parsePowerRankingsUrlState(params("team=paper-rex"))).toEqual({
      mode: "global",
      region: null,
      team: "paper-rex",
    });
  });
});

describe("serializePowerRankingsUrlState", () => {
  it("omits every field at its default", () => {
    expect(serializePowerRankingsUrlState(EMPTY_POWER_RANKINGS_URL_STATE)).toBe("");
  });

  it("round-trips a representative state through parse -> serialize -> parse", () => {
    const state = { mode: "regional" as const, region: "emea" as const, team: "paper-rex" as const };
    const serialized = serializePowerRankingsUrlState(state);
    expect(parsePowerRankingsUrlState(params(serialized))).toEqual(state);
  });

  it("never serializes region without regional mode", () => {
    const state = { mode: "global" as const, region: "emea" as const, team: null };
    expect(serializePowerRankingsUrlState(state)).toBe("");
  });
});

describe("transitions", () => {
  it("withMode(global) clears mode without touching region", () => {
    const state = { mode: "regional" as const, region: "china" as const, team: null };
    expect(withMode(state, "global", "americas")).toEqual({ mode: "global", region: "china", team: null });
  });

  it("withMode(regional) fills in a fallback region only when none is set", () => {
    expect(withMode(EMPTY_POWER_RANKINGS_URL_STATE, "regional", "americas")).toEqual({
      mode: "regional",
      region: "americas",
      team: null,
    });
    const withExistingRegion = { mode: "global" as const, region: "pacific" as const, team: null };
    expect(withMode(withExistingRegion, "regional", "americas")).toEqual({
      mode: "regional",
      region: "pacific",
      team: null,
    });
  });

  it("withRegion replaces the region", () => {
    expect(withRegion(EMPTY_POWER_RANKINGS_URL_STATE, "pacific")).toEqual({
      mode: "global",
      region: "pacific",
      team: null,
    });
  });

  it("withTeam sets or clears the dossier team", () => {
    expect(withTeam(EMPTY_POWER_RANKINGS_URL_STATE, "paper-rex")).toEqual({
      mode: "global",
      region: null,
      team: "paper-rex",
    });
    expect(withTeam({ mode: "global", region: null, team: "paper-rex" }, null)).toEqual(EMPTY_POWER_RANKINGS_URL_STATE);
  });
});
