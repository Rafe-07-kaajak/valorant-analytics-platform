import { describe, expect, it } from "vitest";
import { buildVlrSourceReference, deterministicInternalId, parseVlrSourceReference } from "./deterministicId";

describe("buildVlrSourceReference", () => {
  it("builds a vlr:<type>:<id> reference", () => {
    expect(buildVlrSourceReference("team", "1001")).toBe("vlr:team:1001");
    expect(buildVlrSourceReference("match", "abc-123")).toBe("vlr:match:abc-123");
  });

  it("is deterministic for the same input", () => {
    expect(buildVlrSourceReference("event", "55")).toBe(buildVlrSourceReference("event", "55"));
  });
});

describe("parseVlrSourceReference", () => {
  it("round-trips a built reference", () => {
    const reference = buildVlrSourceReference("player", "42");
    expect(parseVlrSourceReference(reference)).toEqual({ provider: "vlr", entityType: "player", externalId: "42" });
  });

  it("returns null for a malformed reference", () => {
    expect(parseVlrSourceReference("not-a-reference")).toBeNull();
    expect(parseVlrSourceReference("vlr:unknown-type:1")).toBeNull();
  });

  it("preserves external IDs containing colons", () => {
    expect(parseVlrSourceReference("vlr:match:2024:finals:1")).toEqual({
      provider: "vlr",
      entityType: "match",
      externalId: "2024:finals:1",
    });
  });
});

describe("deterministicInternalId", () => {
  it("matches the source reference for unmapped entities", () => {
    expect(deterministicInternalId("team", "77")).toBe("vlr:team:77");
  });

  it("is idempotent across repeated calls", () => {
    expect(deterministicInternalId("event", "99")).toBe(deterministicInternalId("event", "99"));
  });
});
