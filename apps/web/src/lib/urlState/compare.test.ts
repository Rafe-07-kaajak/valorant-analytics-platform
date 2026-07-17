import { describe, expect, it } from "vitest";
import { canonicalStatesEqual } from "./compare";
import { EMPTY_CANONICAL_URL_STATE } from "./types";

describe("canonicalStatesEqual", () => {
  it("treats two structurally identical states as equal, even as distinct objects", () => {
    const a = { ...EMPTY_CANONICAL_URL_STATE, teamA: "paper-rex" as const, maps: ["ascent", "haven"] };
    const b = { ...EMPTY_CANONICAL_URL_STATE, teamA: "paper-rex" as const, maps: ["ascent", "haven"] };
    expect(a).not.toBe(b);
    expect(canonicalStatesEqual(a, b)).toBe(true);
  });

  it("detects a scalar field difference", () => {
    const a = { ...EMPTY_CANONICAL_URL_STATE, teamA: "paper-rex" as const };
    const b = { ...EMPTY_CANONICAL_URL_STATE, teamA: "t1" as const };
    expect(canonicalStatesEqual(a, b)).toBe(false);
  });

  it("detects a maps array difference in length", () => {
    const a = { ...EMPTY_CANONICAL_URL_STATE, maps: ["ascent"] };
    const b = { ...EMPTY_CANONICAL_URL_STATE, maps: ["ascent", "haven"] };
    expect(canonicalStatesEqual(a, b)).toBe(false);
  });

  it("detects a maps array difference in order", () => {
    const a = { ...EMPTY_CANONICAL_URL_STATE, maps: ["ascent", "haven"] };
    const b = { ...EMPTY_CANONICAL_URL_STATE, maps: ["haven", "ascent"] };
    expect(canonicalStatesEqual(a, b)).toBe(false);
  });
});
