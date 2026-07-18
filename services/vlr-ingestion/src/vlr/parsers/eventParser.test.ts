import { describe, expect, it } from "vitest";
import { parseEventPage } from "./eventParser";
import { readFixture } from "../../testUtils/readFixture";

const source = (id: string) => ({ sourceUrl: `https://www.vlr.gg/event/${id}/name`, fetchedAt: "2026-07-18T00:00:00.000Z" });

describe("parseEventPage", () => {
  it("parses the VCT Americas fixture with structured metadata intact", () => {
    const result = parseEventPage(readFixture("event-page-vct-americas.html"), source("2001"));
    expect(result.errors).toHaveLength(0);
    expect(result.value).toMatchObject({
      vlrEventId: "2001",
      name: "VCT 2025: Americas Stage 1",
      status: "completed",
      region: "americas",
      parentSeries: "Champions Tour",
      season: "2025",
      stage: "Stage 1",
      startDateIso: "2025-01-15T00:00:00.000Z",
      endDateIso: "2025-03-01T00:00:00.000Z",
    });
    expect(result.value?.rawCategoryLabels).toEqual(["league"]);
  });

  it("parses the Masters fixture", () => {
    const result = parseEventPage(readFixture("event-page-masters.html"), source("3001"));
    expect(result.value?.parentSeries).toBe("VCT Masters");
    expect(result.value?.name).toBe("Masters Bangkok 2025");
  });

  it("parses the Champions fixture", () => {
    const result = parseEventPage(readFixture("event-page-champions.html"), source("4001"));
    expect(result.value?.parentSeries).toBe("Champions");
  });

  it("parses the unknown-event fixture without inventing a classification", () => {
    const result = parseEventPage(readFixture("event-page-unknown.html"), source("8001"));
    expect(result.errors).toHaveLength(0);
    expect(result.value?.name).toBe("Local LAN Weekly #12");
    expect(result.value?.rawCategoryLabels).toBeUndefined();
  });

  it("returns a fatal error for an unrecognized status value", () => {
    const html = `<div class="event-page" data-event-id="1"><h1 class="event-header-name">X</h1><div class="event-header-status">weird</div></div>`;
    const result = parseEventPage(html, source("1"));
    expect(result.value).toBeNull();
    expect(result.errors.some((e) => e.message.includes("status"))).toBe(true);
  });

  it("flags ambiguous dates instead of guessing a timezone", () => {
    const html = `<div class="event-page" data-event-id="1"><h1 class="event-header-name">X</h1><div class="event-header-status">completed</div><div class="event-header-dates" data-start="not-a-date">sometime</div></div>`;
    const result = parseEventPage(html, source("1"));
    expect(result.value?.startDateIso).toBeUndefined();
    expect(result.warnings.some((w) => w.code === "ambiguous_timezone")).toBe(true);
  });
});
