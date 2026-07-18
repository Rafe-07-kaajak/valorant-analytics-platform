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

  it("captures team names (real markup exposes no team ID at this stage), status, round, and day heading", () => {
    const result = parseMatchListPage(readFixture("match-list-page.html"), SOURCE);
    expect(result.value?.[0]).toMatchObject({
      teamANameRaw: "Fnatic",
      teamBNameRaw: "Team Liquid",
      status: "completed",
      roundStageText: "Grand Final Playoffs",
      scheduledAtRaw: "Sat, January 15, 2025 6:00 PM",
      vlrEventId: "2001",
    });
    expect(result.value?.[0]?.teamAVlrTeamId).toBeUndefined();
  });

  it("returns a fatal error when no recognizable event page chrome is present", () => {
    const result = parseMatchListPage("<div>nothing</div>", SOURCE);
    expect(result.value).toBeNull();
    expect(result.errors[0]?.code).toBe("critical_field_missing");
  });

  it("treats a genuinely empty match list (e.g. an event with no matches yet) as a valid, non-fatal empty result", () => {
    const result = parseMatchListPage(`<div class="event-header"></div>`, SOURCE);
    expect(result.errors).toHaveLength(0);
    expect(result.value).toEqual([]);
  });

  it("skips an item missing a required field (ID or status) without throwing", () => {
    const html = `<div class="event-header"></div><div class="wf-card"><a class="match-item" href="/1"></a></div>`;
    const result = parseMatchListPage(html, SOURCE);
    expect(result.value).toHaveLength(0);
    expect(result.warnings.some((w) => w.code === "partial_record")).toBe(true);
  });
});
