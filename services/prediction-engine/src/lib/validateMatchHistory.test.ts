import { describe, expect, it } from "vitest";
import type { RawMatchRecord } from "../data/matchHistory";
import { syntheticMatchHistory } from "../data/matchHistory";
import { validateMatchHistory, validateMatchRecord } from "./validateMatchHistory";

function validRecord(): RawMatchRecord {
  return structuredClone(syntheticMatchHistory[0]!);
}

describe("validateMatchHistory", () => {
  it("quarantines zero records from the TASK-011 generated dataset", () => {
    const result = validateMatchHistory(syntheticMatchHistory);

    expect(result.quarantined).toHaveLength(0);
    expect(result.valid).toHaveLength(syntheticMatchHistory.length);
  });

  it("keeps valid records untouched", () => {
    const result = validateMatchHistory(syntheticMatchHistory);
    expect(result.valid).toEqual(syntheticMatchHistory);
  });

  it("quarantines a duplicate match ID instead of accepting it twice", () => {
    const original = validRecord();
    const duplicate = structuredClone(original);

    const result = validateMatchHistory([original, duplicate]);

    expect(result.valid).toEqual([original]);
    expect(result.quarantined).toHaveLength(1);
    expect(result.quarantined[0]!.reasons.join(" ")).toMatch(/duplicate/i);
  });

  it("never throws for a deliberately malformed fixture", () => {
    const malformedFixtures: unknown[] = [null, undefined, {}, "not-a-record", 42, []];

    expect(() => validateMatchHistory(malformedFixtures as unknown as RawMatchRecord[])).not.toThrow();

    const result = validateMatchHistory(malformedFixtures as unknown as RawMatchRecord[]);
    expect(result.valid).toHaveLength(0);
    expect(result.quarantined).toHaveLength(malformedFixtures.length);
    for (const entry of result.quarantined) {
      expect(entry.reasons.length).toBeGreaterThan(0);
    }
  });
});

describe("validateMatchRecord", () => {
  const noSeen = new Set<string>();

  it("accepts a well-formed record", () => {
    expect(validateMatchRecord(validRecord(), noSeen)).toEqual([]);
  });

  it("rejects a record missing required fields", () => {
    const record = validRecord() as unknown as Record<string, unknown>;
    delete record.matchId;
    delete record.teamA;

    const reasons = validateMatchRecord(record, noSeen);
    expect(reasons.length).toBeGreaterThan(0);
    expect(reasons.some((reason) => reason.includes("matchId"))).toBe(true);
  });

  it("rejects an unknown team ID", () => {
    const record = validRecord();
    record.teamA.teamId = "not-a-real-team";

    const reasons = validateMatchRecord(record, noSeen);
    expect(reasons.some((reason) => reason.includes("teamA") && reason.includes("unknown team"))).toBe(true);
  });

  it("rejects an unknown map ID", () => {
    const record = validRecord();
    record.mapId = "fracture";

    const reasons = validateMatchRecord(record, noSeen);
    expect(reasons.some((reason) => reason.includes("unknown map"))).toBe(true);
  });

  it("rejects a malformed timestamp", () => {
    const record = validRecord();
    record.playedAt = "not-a-date";

    const reasons = validateMatchRecord(record, noSeen);
    expect(reasons.some((reason) => reason.includes("playedAt"))).toBe(true);
  });

  it("rejects a future timestamp", () => {
    const record = validRecord();
    record.playedAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();

    const reasons = validateMatchRecord(record, noSeen);
    expect(reasons.some((reason) => reason.includes("playedAt"))).toBe(true);
  });

  it("rejects an impossible round total below the minimum win threshold", () => {
    const record = validRecord();
    record.teamA.roundsWon = 3;
    record.teamB.roundsWon = 2;

    const reasons = validateMatchRecord(record, noSeen);
    expect(reasons.some((reason) => reason.includes("Total rounds"))).toBe(true);
  });

  it("rejects an economy breakdown that does not sum to the total rounds", () => {
    const record = validRecord();
    record.teamA.economy.fullBuy.roundsPlayed += 5;

    const reasons = validateMatchRecord(record, noSeen);
    expect(reasons.some((reason) => reason.includes("economy rounds played"))).toBe(true);
  });

  it("rejects an economy bucket with more rounds won than played", () => {
    const record = validRecord();
    record.teamA.economy.eco.roundsPlayed = 1;
    record.teamA.economy.eco.roundsWon = 5;

    const reasons = validateMatchRecord(record, noSeen);
    expect(reasons.some((reason) => reason.includes("more rounds won than played"))).toBe(true);
  });

  it("rejects a clutch outcome with more situations won than faced", () => {
    const record = validRecord();
    record.teamA.clutches.situationsFaced = 1;
    record.teamA.clutches.situationsWon = 4;

    const reasons = validateMatchRecord(record, noSeen);
    expect(reasons.some((reason) => reason.includes("more clutch situations won than faced"))).toBe(true);
  });

  it("rejects a record where both teams reference the same team ID", () => {
    const record = validRecord();
    record.teamB.teamId = record.teamA.teamId;

    const reasons = validateMatchRecord(record, noSeen);
    expect(reasons.some((reason) => reason.includes("same team"))).toBe(true);
  });

  it("flags a duplicate match ID when already seen", () => {
    const record = validRecord();
    const seen = new Set([record.matchId]);

    const reasons = validateMatchRecord(record, seen);
    expect(reasons.some((reason) => reason.includes("Duplicate match ID"))).toBe(true);
  });
});
