import { describe, expect, it } from "vitest";
import { EMPTY_CANONICAL_URL_STATE, type CanonicalUrlState } from "./types";
import { pickCanonicalFields, projectCanonicalState, serializeUrlState, toUrlSearchParams } from "./serialize";

const FULL_STATE: CanonicalUrlState = {
  regionA: "pacific",
  teamA: "paper-rex",
  regionB: "americas",
  teamB: "g2-esports",
  maps: ["ascent", "haven", "bind"],
  format: "BO3",
  mode: null,
};

describe("serializeUrlState", () => {
  it("serializes all six fields in canonical order", () => {
    expect(serializeUrlState(FULL_STATE, ["regionA", "teamA", "regionB", "teamB", "maps", "format"])).toBe(
      "regionA=pacific&teamA=paper-rex&regionB=americas&teamB=g2-esports&maps=ascent%2Chaven%2Cbind&format=BO3",
    );
  });

  it("preserves canonical field order regardless of the order fields are requested in", () => {
    const reversed = serializeUrlState(FULL_STATE, ["format", "maps", "teamB", "regionB", "teamA", "regionA"]);
    expect(reversed).toBe(serializeUrlState(FULL_STATE, ["regionA", "teamA", "regionB", "teamB", "maps", "format"]));
  });

  it("omits empty/default parameters", () => {
    expect(serializeUrlState(EMPTY_CANONICAL_URL_STATE, ["regionA", "teamA", "regionB", "teamB", "maps", "format"])).toBe("");
  });

  it("only serializes fields it was told to own, even if the state object has more", () => {
    expect(serializeUrlState(FULL_STATE, ["teamA", "teamB"])).toBe("teamA=paper-rex&teamB=g2-esports");
  });

  it("omits maps when the pool is empty", () => {
    expect(serializeUrlState({ ...FULL_STATE, maps: [] }, ["maps"])).toBe("");
  });

  it("is deterministic across repeated calls with the same input", () => {
    const a = serializeUrlState(FULL_STATE, ["regionA", "teamA", "regionB", "teamB", "maps", "format"]);
    const b = serializeUrlState(FULL_STATE, ["regionA", "teamA", "regionB", "teamB", "maps", "format"]);
    expect(a).toBe(b);
  });

  it("never emits raw JSON", () => {
    const query = serializeUrlState(FULL_STATE, ["regionA", "teamA", "regionB", "teamB", "maps", "format"]);
    expect(query).not.toMatch(/[{}[\]]/);
  });
});

describe("pickCanonicalFields", () => {
  it("returns only the requested keys", () => {
    expect(pickCanonicalFields(FULL_STATE, ["teamA", "teamB"])).toEqual({ teamA: "paper-rex", teamB: "g2-esports" });
  });
});

describe("projectCanonicalState", () => {
  it("resets fields the destination doesn't own to empty", () => {
    expect(projectCanonicalState(FULL_STATE, ["teamA", "teamB", "regionA", "regionB"])).toEqual({
      regionA: "pacific",
      teamA: "paper-rex",
      regionB: "americas",
      teamB: "g2-esports",
      maps: [],
      format: null,
      mode: null,
    });
  });
});

describe("toUrlSearchParams", () => {
  it("adapts a Next.js server searchParams object", () => {
    const params = toUrlSearchParams({ teamA: "paper-rex", maps: "ascent,haven" });
    expect(params.get("teamA")).toBe("paper-rex");
    expect(params.get("maps")).toBe("ascent,haven");
  });

  it("takes the first value when a key is repeated (string array)", () => {
    const params = toUrlSearchParams({ teamA: ["paper-rex", "t1"] });
    expect(params.get("teamA")).toBe("paper-rex");
  });

  it("skips undefined values", () => {
    const params = toUrlSearchParams({ teamA: undefined });
    expect(params.has("teamA")).toBe(false);
  });
});
