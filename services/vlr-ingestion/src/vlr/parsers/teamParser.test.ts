import { describe, expect, it } from "vitest";
import { parseTeamPage } from "./teamParser";
import { readFixture } from "../../testUtils/readFixture";

const SOURCE = { sourceUrl: "https://www.vlr.gg/team/2593/fnatic", fetchedAt: "2026-07-18T00:00:00.000Z" };

describe("parseTeamPage", () => {
  it("parses the full happy-path team fixture", () => {
    const result = parseTeamPage(readFixture("team-page.html"), SOURCE);
    expect(result.errors).toHaveLength(0);
    expect(result.value).toMatchObject({
      vlrTeamId: "2593",
      name: "Fnatic",
      shortName: "FNC",
      region: "United Kingdom",
      profileUrl: SOURCE.sourceUrl,
      activeRosterVlrPlayerIds: ["101", "102"],
    });
  });

  it("returns a fatal error when the root element is missing", () => {
    const result = parseTeamPage("<div>not a team page</div>", SOURCE);
    expect(result.value).toBeNull();
    expect(result.errors[0]?.code).toBe("critical_field_missing");
  });

  it("returns a fatal error when the team name is missing", () => {
    const html = `<div class="team-header" data-team-id="1"></div>`;
    const result = parseTeamPage(html, SOURCE);
    expect(result.value).toBeNull();
    expect(result.errors.some((e) => e.message.includes("name"))).toBe(true);
  });

  it("falls back to the data-team-id attribute when the URL has no ID, with a warning", () => {
    const html = readFixture("team-page.html");
    const result = parseTeamPage(html, { sourceUrl: "https://www.vlr.gg/teams/overview", fetchedAt: SOURCE.fetchedAt });
    expect(result.value?.vlrTeamId).toBe("2593");
    expect(result.warnings.some((w) => w.code === "parser_fallback_used")).toBe(true);
  });

  it("reads the name from the h1 specifically, not the tag nested alongside it in .team-header-name", () => {
    const result = parseTeamPage(readFixture("team-page.html"), SOURCE);
    expect(result.value?.name).toBe("Fnatic");
    expect(result.value?.shortName).toBe("FNC");
  });

  it("is deterministic across repeated parses of the same input", () => {
    const first = parseTeamPage(readFixture("team-page.html"), SOURCE);
    const second = parseTeamPage(readFixture("team-page.html"), SOURCE);
    expect(first.value).toEqual(second.value);
  });
});
