import { describe, expect, it } from "vitest";
import { buildPlayerHandleHistory, detectDuplicateHandles, isMissingPlayerId, resolvePlayerIdentity } from "./playerIdentity";
import type { PlayerHandleObservation } from "./playerIdentity";

describe("resolvePlayerIdentity", () => {
  it("resolves the deterministic canonical ID for a VLR player ID", () => {
    expect(resolvePlayerIdentity("12345")).toEqual({ internalId: "vlr:player:12345", vlrPlayerId: "12345" });
  });
});

describe("buildPlayerHandleHistory", () => {
  it("builds a chronological handle history for one player ID that changed handles", () => {
    const observations: PlayerHandleObservation[] = [
      { vlrPlayerId: "1", handle: "OldHandle", observedAt: "2025-01-01T00:00:00Z" },
      { vlrPlayerId: "1", handle: "NewHandle", observedAt: "2026-01-01T00:00:00Z" },
    ];
    const history = buildPlayerHandleHistory(observations);
    const aliases = history.get("1")!;
    expect(aliases.map((a) => a.handle)).toEqual(["OldHandle", "NewHandle"]);
  });

  it("does not duplicate a handle seen multiple times for the same ID", () => {
    const observations: PlayerHandleObservation[] = [
      { vlrPlayerId: "1", handle: "Handle", observedAt: "t1" },
      { vlrPlayerId: "1", handle: "Handle", observedAt: "t2" },
    ];
    expect(buildPlayerHandleHistory(observations).get("1")).toHaveLength(1);
  });
});

describe("detectDuplicateHandles", () => {
  it("flags the same handle observed under two distinct VLR player IDs", () => {
    const observations: PlayerHandleObservation[] = [
      { vlrPlayerId: "1", handle: "Ace", observedAt: "t1" },
      { vlrPlayerId: "2", handle: "Ace", observedAt: "t2" },
    ];
    const conflicts = detectDuplicateHandles(observations);
    expect(conflicts).toEqual([{ handle: "Ace", conflictingVlrPlayerIds: ["1", "2"] }]);
  });

  it("does not flag a handle used by only one player ID", () => {
    const observations: PlayerHandleObservation[] = [{ vlrPlayerId: "1", handle: "Ace", observedAt: "t1" }];
    expect(detectDuplicateHandles(observations)).toHaveLength(0);
  });
});

describe("isMissingPlayerId", () => {
  it("flags undefined, null, and empty-string IDs as missing", () => {
    expect(isMissingPlayerId(undefined)).toBe(true);
    expect(isMissingPlayerId(null)).toBe(true);
    expect(isMissingPlayerId("")).toBe(true);
    expect(isMissingPlayerId("  ")).toBe(true);
  });

  it("does not flag a real ID", () => {
    expect(isMissingPlayerId("12345")).toBe(false);
  });
});
