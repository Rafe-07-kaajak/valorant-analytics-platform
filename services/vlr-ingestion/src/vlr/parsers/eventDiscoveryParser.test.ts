import { describe, expect, it } from "vitest";
import { parseEventDiscoveryPage } from "./eventDiscoveryParser";
import { readFixture } from "../../testUtils/readFixture";

const SOURCE = { sourceUrl: "https://www.vlr.gg/events?page=1" };

describe("parseEventDiscoveryPage", () => {
  it("parses every discovery item, including the deliberately duplicated one", () => {
    const result = parseEventDiscoveryPage(readFixture("event-discovery-page.html"), SOURCE);
    expect(result.errors).toHaveLength(0);
    expect(result.value).toHaveLength(4);
    expect(result.value?.map((entry) => entry.vlrEventId)).toEqual(["2001", "3001", "5001", "2001"]);
  });

  it("resolves relative hrefs against the source URL", () => {
    const result = parseEventDiscoveryPage(readFixture("event-discovery-page.html"), SOURCE);
    expect(result.value?.[0]?.eventUrl).toBe("https://www.vlr.gg/event/2001");
  });

  it("returns a fatal error when the discovery list root is missing", () => {
    const result = parseEventDiscoveryPage("<div>nothing here</div>", SOURCE);
    expect(result.value).toBeNull();
    expect(result.errors[0]?.code).toBe("critical_field_missing");
  });

  it("warns and skips list items missing an ID or name, without throwing", () => {
    const html = `<div class="events-container"><a class="event-item" href="/event/1"></a></div>`;
    const result = parseEventDiscoveryPage(html, SOURCE);
    expect(result.value).toHaveLength(0);
    expect(result.warnings.some((w) => w.code === "partial_record")).toBe(true);
  });
});
