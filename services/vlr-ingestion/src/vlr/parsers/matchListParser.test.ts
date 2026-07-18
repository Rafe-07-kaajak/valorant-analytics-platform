import { describe, expect, it } from "vitest";
import { parseMatchListPage } from "./matchListParser";
import { readFixture } from "../../testUtils/readFixture";

const SOURCE = { sourceUrl: "https://www.vlr.gg/event/matches/2001", fetchedAt: "2026-07-18T00:00:00.000Z", vlrEventId: "2001" };

describe("parseMatchListPage", () => {
  it("parses every match-list entry, including the deliberately duplicated one", () => {
    const result = parseMatchListPage(readFixture("match-list-page.html"), SOURCE);
    expect(result.errors).toHaveLength(0);
    expect(result.value).toHaveLength(3);
    expect(result.value?.map((m) => m.vlrMatchId)).toEqual(["347540", "347541", "347540"]);
  });

  it("captures teams, status, round, and series format", () => {
    const result = parseMatchListPage(readFixture("match-list-page.html"), SOURCE);
    expect(result.value?.[0]).toMatchObject({
      teamAVlrTeamId: "2593",
      teamBVlrTeamId: "2594",
      status: "completed",
      roundStageText: "Grand Final",
      seriesFormatRaw: "Bo3",
      vlrEventId: "2001",
    });
  });

  it("returns a fatal error when the match-list root is missing", () => {
    const result = parseMatchListPage("<div>nothing</div>", SOURCE);
    expect(result.value).toBeNull();
    expect(result.errors[0]?.code).toBe("critical_field_missing");
  });

  it("skips an item missing a required team without throwing", () => {
    const html = `<div class="match-list"><a class="match-list-item" href="/1" data-status="completed"><span class="match-team" data-team-id="1">A</span></a></div>`;
    const result = parseMatchListPage(html, SOURCE);
    expect(result.value).toHaveLength(0);
    expect(result.warnings.some((w) => w.code === "partial_record")).toBe(true);
  });
});
