import { describe, expect, it } from "vitest";
import { parseMatchDetailPage } from "./matchDetailParser";
import { readFixture } from "../../testUtils/readFixture";

const source = (id: string) => ({ sourceUrl: `https://www.vlr.gg/${id}/fnatic-vs-team-liquid`, fetchedAt: "2026-07-18T00:00:00.000Z", vlrEventId: "2001" });

describe("parseMatchDetailPage — completed match", () => {
  it("parses all three maps with attack/defense splits and the overtime flag", () => {
    const result = parseMatchDetailPage(readFixture("match-completed.html"), source("347540"));
    expect(result.errors).toHaveLength(0);
    expect(result.value?.maps).toHaveLength(3);
    expect(result.value?.maps[2]).toMatchObject({ mapNameRaw: "Lotus", overtime: true, teamAScore: 15, teamBScore: 13 });
  });

  it("resolves the winner from the flagged team", () => {
    const result = parseMatchDetailPage(readFixture("match-completed.html"), source("347540"));
    expect(result.value?.winnerVlrTeamId).toBe("2593");
    expect(result.warnings.some((w) => w.code === "inconsistent_winner")).toBe(false);
  });

  it("is idempotent across repeated parses", () => {
    const first = parseMatchDetailPage(readFixture("match-completed.html"), source("347540"));
    const second = parseMatchDetailPage(readFixture("match-completed.html"), source("347540"));
    expect(first.value).toEqual(second.value);
  });
});

describe("parseMatchDetailPage — scheduled match", () => {
  it("parses an upcoming match with no maps yet", () => {
    const result = parseMatchDetailPage(readFixture("match-scheduled.html"), source("347999"));
    expect(result.errors).toHaveLength(0);
    expect(result.value?.status).toBe("upcoming");
    expect(result.value?.maps).toHaveLength(0);
    expect(result.value?.winnerVlrTeamId).toBeUndefined();
  });
});

describe("parseMatchDetailPage — postponed match", () => {
  it("parses a postponed match without treating it as completed", () => {
    const result = parseMatchDetailPage(readFixture("match-postponed.html"), source("349002"));
    expect(result.value?.status).toBe("postponed");
    expect(result.value?.maps).toHaveLength(0);
  });
});

describe("parseMatchDetailPage — missing optional fields", () => {
  it("tolerates a missing series format, patch, and attack/defense splits", () => {
    const result = parseMatchDetailPage(readFixture("match-missing-fields.html"), source("348001"));
    expect(result.errors).toHaveLength(0);
    expect(result.value?.seriesFormatRaw).toBeUndefined();
    expect(result.value?.patch).toBeUndefined();
    expect(result.value?.maps[0]?.teamAAttackScore).toBeUndefined();
    expect(result.value?.maps[0]?.teamAScore).toBe(13);
  });
});

describe("parseMatchDetailPage — malformed markup", () => {
  it("returns a fatal, controlled error instead of a silently empty record", () => {
    const result = parseMatchDetailPage(readFixture("match-malformed.html"), source("348999"));
    expect(result.value).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.every((e) => e.code === "critical_field_missing")).toBe(true);
  });
});
