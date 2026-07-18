import { describe, expect, it } from "vitest";
import { parseEventPage } from "./eventParser";
import { readFixture } from "../../testUtils/readFixture";

function source(id: string, statusHint: "upcoming" | "ongoing" | "completed" = "completed") {
  return { sourceUrl: `https://www.vlr.gg/event/${id}/name`, fetchedAt: "2026-07-18T00:00:00.000Z", statusHint };
}

function sourceWithoutStatusHint(id: string) {
  return { sourceUrl: `https://www.vlr.gg/event/${id}/name`, fetchedAt: "2026-07-18T00:00:00.000Z" };
}

describe("parseEventPage", () => {
  it("parses the VCT Americas fixture with structured metadata intact", () => {
    const result = parseEventPage(readFixture("event-page-vct-americas.html"), source("2001"));
    expect(result.errors).toHaveLength(0);
    expect(result.value).toMatchObject({
      vlrEventId: "2001",
      name: "VCT 2025: Americas Stage 1",
      status: "completed",
      region: "americas",
      parentSeries: "Champions Tour 2025",
      season: "2025",
      stage: "Stage 1",
      startDateIso: "2025-01-15T00:00:00.000Z",
      endDateIso: "2025-03-01T00:00:00.000Z",
      listedMatchCount: 30,
    });
    expect(result.value?.rawCategoryLabels).toEqual(["Stage 1", "Americas"]);
  });

  it("parses the Masters fixture, identifying it via the breadcrumb stage tag", () => {
    const result = parseEventPage(readFixture("event-page-masters.html"), source("3001"));
    expect(result.value?.parentSeries).toBe("Champions Tour 2025");
    expect(result.value?.stage).toBe("Masters");
    expect(result.value?.name).toBe("Masters Bangkok 2025");
    expect(result.value?.startDateIso).toBe("2025-02-10T00:00:00.000Z");
    expect(result.value?.endDateIso).toBe("2025-02-23T00:00:00.000Z");
  });

  it("parses the Champions fixture, leaving region unset for a multi-region international event", () => {
    const result = parseEventPage(readFixture("event-page-champions.html"), source("4001"));
    expect(result.value?.parentSeries).toBe("Champions Tour 2025");
    expect(result.value?.name).toBe("Valorant Champions 2025");
    expect(result.value?.stage).toBeUndefined();
    expect(result.value?.region).toBeUndefined();
  });

  it("parses the unknown-event fixture without inventing a classification", () => {
    const result = parseEventPage(readFixture("event-page-unknown.html"), source("8001"));
    expect(result.errors).toHaveLength(0);
    expect(result.value?.name).toBe("Local LAN Weekly #12");
    expect(result.value?.rawCategoryLabels).toBeUndefined();
  });

  it("returns a fatal error when no statusHint is supplied, since real event-detail pages carry no status text", () => {
    const result = parseEventPage(readFixture("event-page-vct-americas.html"), sourceWithoutStatusHint("2001"));
    expect(result.value).toBeNull();
    expect(result.errors.some((e) => e.message.includes("status"))).toBe(true);
  });

  it("returns a fatal error when the header root is missing", () => {
    const html = `<div>not an event page</div>`;
    const result = parseEventPage(html, source("1"));
    expect(result.value).toBeNull();
    expect(result.errors[0]?.code).toBe("critical_field_missing");
  });

  it("flags ambiguous dates instead of guessing a year", () => {
    const html = `
      <div class="event-header">
        <div class="event-header-main">
          <div class="event-header-main-bc"><a href="/vct">Champions Tour 2025</a></div>
          <h1 class="event-header-main-title">X</h1>
          <div class="event-header-main-meta">
            <div><div class="ge-text-light label">Dates</div><div class="value">sometime soon</div></div>
          </div>
        </div>
      </div>`;
    const result = parseEventPage(html, source("1"));
    expect(result.value?.startDateIso).toBeUndefined();
    expect(result.warnings.some((w) => w.code === "ambiguous_timezone")).toBe(true);
  });
});
