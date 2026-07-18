import { describe, expect, it } from "vitest";
import { parseMatchDetailPage } from "./matchDetailParser";
import { readFixture } from "../../testUtils/readFixture";

const source = (id: string, statusHint?: "upcoming" | "live" | "completed" | "postponed" | "cancelled") => ({
  sourceUrl: `https://www.vlr.gg/${id}/fnatic-vs-team-liquid`,
  fetchedAt: "2026-07-18T00:00:00.000Z",
  vlrEventId: "2001",
  statusHint,
});

describe("parseMatchDetailPage — completed match", () => {
  it("parses all three maps with attack/defense splits and the overtime flag", () => {
    const result = parseMatchDetailPage(readFixture("match-completed.html"), source("347540"));
    expect(result.errors).toHaveLength(0);
    expect(result.value?.maps).toHaveLength(3);
    expect(result.value?.maps.find((m) => m.mapNameRaw === "Lotus")).toMatchObject({ overtime: true, teamAScore: 15, teamBScore: 13, order: 3 });
    expect(result.value?.maps.find((m) => m.mapNameRaw === "Ascent")).toMatchObject({ teamAScore: 13, teamBScore: 9, teamAAttackScore: 7, teamADefenseScore: 6, overtime: false });
  });

  it("resolves the series winner and team identity from the .match-header-link hrefs (real markup carries no data-team-id attribute)", () => {
    const result = parseMatchDetailPage(readFixture("match-completed.html"), source("347540"));
    expect(result.value?.teamAVlrTeamId).toBe("2593");
    expect(result.value?.teamBVlrTeamId).toBe("2594");
    expect(result.value?.winnerVlrTeamId).toBe("2593");
    expect(result.warnings.some((w) => w.code === "inconsistent_winner")).toBe(false);
  });

  it("infers status as completed from the 'final' note text when no statusHint is supplied", () => {
    const result = parseMatchDetailPage(readFixture("match-completed.html"), source("347540"));
    expect(result.value?.status).toBe("completed");
  });

  it("normalizes the scheduled timestamp from the data-utc-ts attribute (an unambiguous UTC source)", () => {
    const result = parseMatchDetailPage(readFixture("match-completed.html"), source("347540"));
    expect(result.value?.scheduledAtIso).toBe("2025-01-15T18:00:00.000Z");
  });

  it("extracts the roster that actually played from the aggregate stats table, as internal VLR player IDs", () => {
    const result = parseMatchDetailPage(readFixture("match-completed.html"), source("347540"));
    expect(result.value?.rostersAtMatchTime).toHaveLength(2);
    expect(result.value?.rostersAtMatchTime?.[0]).toMatchObject({ teamVlrTeamId: "2593", vlrPlayerIds: ["101", "102", "103", "104", "105"] });
    expect(result.value?.rostersAtMatchTime?.[1]).toMatchObject({ teamVlrTeamId: "2594", vlrPlayerIds: ["106", "107", "108", "109", "110"] });
  });

  it("is idempotent across repeated parses", () => {
    const first = parseMatchDetailPage(readFixture("match-completed.html"), source("347540"));
    const second = parseMatchDetailPage(readFixture("match-completed.html"), source("347540"));
    expect(first.value).toEqual(second.value);
  });
});

describe("parseMatchDetailPage — scheduled match", () => {
  it("parses an upcoming match with no maps yet, inferring status from the presence of a scheduled timestamp", () => {
    const result = parseMatchDetailPage(readFixture("match-scheduled.html"), source("347999"));
    expect(result.errors).toHaveLength(0);
    expect(result.value?.status).toBe("upcoming");
    expect(result.value?.maps).toHaveLength(0);
    expect(result.value?.winnerVlrTeamId).toBeUndefined();
  });
});

describe("parseMatchDetailPage — postponed match", () => {
  it("parses a postponed match without treating it as completed (statusHint required — real markup has no postponed signal of its own)", () => {
    const result = parseMatchDetailPage(readFixture("match-postponed.html"), source("349002", "postponed"));
    expect(result.value?.status).toBe("postponed");
    expect(result.value?.maps).toHaveLength(0);
  });

  it("returns a fatal error if no statusHint is supplied and the page gives no other status signal at all", () => {
    const html = `
      <div class="match-header">
        <a class="match-header-link mod-1" href="/team/2593/fnatic"></a>
        <div class="match-header-vs-score"></div>
        <a class="match-header-link mod-2" href="/team/2594/team-liquid"></a>
      </div>`;
    const result = parseMatchDetailPage(html, source("349002"));
    expect(result.value).toBeNull();
    expect(result.errors.some((e) => e.message.includes("status"))).toBe(true);
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
