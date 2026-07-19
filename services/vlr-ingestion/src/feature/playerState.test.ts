import { describe, expect, it } from "vitest";
import { PlayerRegistry } from "./playerState";

const DAY_MS = 86_400_000;

describe("PlayerRegistry", () => {
  it("reports zero prior appearances for an unseen player", () => {
    const registry = new PlayerRegistry();
    expect(registry.priorAppearanceCount("p1")).toBe(0);
    expect(registry.priorWinCount("p1")).toBe(0);
    expect(registry.hasAppeared("p1")).toBe(false);
  });

  it("counts appearances and wins after recording them", () => {
    const registry = new PlayerRegistry();
    registry.recordAppearance("p1", { matchInternalId: "m1", timestampMs: 0, teamInternalId: "t1", won: true, isInternational: false, isMastersOrChampions: false });
    registry.recordAppearance("p1", { matchInternalId: "m2", timestampMs: DAY_MS, teamInternalId: "t1", won: false, isInternational: false, isMastersOrChampions: false });
    expect(registry.priorAppearanceCount("p1")).toBe(2);
    expect(registry.priorWinCount("p1")).toBe(1);
    expect(registry.hasAppeared("p1")).toBe(true);
  });

  it("a player's future appearance never affects an earlier read (no future leakage)", () => {
    const registry = new PlayerRegistry();
    const beforeAnyAppearance = registry.priorAppearanceCount("p1");
    registry.recordAppearance("p1", { matchInternalId: "m1", timestampMs: 0, teamInternalId: "t1", won: true, isInternational: false, isMastersOrChampions: false });
    expect(beforeAnyAppearance).toBe(0);
  });

  it("counts only appearances within the requested recency window", () => {
    const registry = new PlayerRegistry();
    registry.recordAppearance("p1", { matchInternalId: "m1", timestampMs: 0, teamInternalId: "t1", won: true, isInternational: false, isMastersOrChampions: false });
    registry.recordAppearance("p1", { matchInternalId: "m2", timestampMs: 40 * DAY_MS, teamInternalId: "t1", won: true, isInternational: false, isMastersOrChampions: false });
    const nowMs = 45 * DAY_MS;
    expect(registry.priorAppearancesSince("p1", nowMs - 30 * DAY_MS)).toBe(1);
  });

  it("tracks international and Masters/Champions appearance counts independently", () => {
    const registry = new PlayerRegistry();
    registry.recordAppearance("p1", { matchInternalId: "m1", timestampMs: 0, teamInternalId: "t1", won: true, isInternational: true, isMastersOrChampions: true });
    registry.recordAppearance("p1", { matchInternalId: "m2", timestampMs: DAY_MS, teamInternalId: "t1", won: true, isInternational: false, isMastersOrChampions: false });
    expect(registry.priorInternationalAppearanceCount("p1")).toBe(1);
    expect(registry.priorMastersChampionsAppearanceCount("p1")).toBe(1);
    expect(registry.priorAppearanceCount("p1")).toBe(2);
  });
});
