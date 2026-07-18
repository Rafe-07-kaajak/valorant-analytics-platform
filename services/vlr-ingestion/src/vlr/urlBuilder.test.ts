import { describe, expect, it } from "vitest";
import {
  assertApprovedUrl,
  buildEventListUrl,
  buildEventMatchesUrl,
  buildEventUrl,
  buildMatchUrl,
  buildTeamUrl,
  isValidVlrId,
} from "./urlBuilder";
import { IngestionError } from "../errors";

const BASE_URL = "https://www.vlr.gg";
const APPROVED_HOST = "www.vlr.gg";

describe("isValidVlrId", () => {
  it("accepts alphanumeric IDs with dashes and underscores", () => {
    expect(isValidVlrId("2593")).toBe(true);
    expect(isValidVlrId("event-1")).toBe(true);
    expect(isValidVlrId("a_b")).toBe(true);
  });

  it("rejects path traversal and separator characters", () => {
    expect(isValidVlrId("../etc/passwd")).toBe(false);
    expect(isValidVlrId("1/2")).toBe(false);
    expect(isValidVlrId("")).toBe(false);
  });

  it("rejects IDs longer than 64 characters", () => {
    expect(isValidVlrId("a".repeat(65))).toBe(false);
  });
});

describe("URL builders — happy path", () => {
  it("builds a team URL", () => {
    expect(buildTeamUrl(BASE_URL, APPROVED_HOST, "2593").toString()).toBe("https://www.vlr.gg/team/2593");
  });

  it("builds an event URL", () => {
    expect(buildEventUrl(BASE_URL, APPROVED_HOST, "100").toString()).toBe("https://www.vlr.gg/event/100");
  });

  it("builds an event-matches URL", () => {
    expect(buildEventMatchesUrl(BASE_URL, APPROVED_HOST, "100").toString()).toBe("https://www.vlr.gg/event/matches/100");
  });

  it("builds a match URL", () => {
    expect(buildMatchUrl(BASE_URL, APPROVED_HOST, "347540").toString()).toBe("https://www.vlr.gg/347540");
  });

  it("builds a bounded event-list discovery URL", () => {
    expect(buildEventListUrl(BASE_URL, APPROVED_HOST, 3).toString()).toBe("https://www.vlr.gg/events?page=3");
  });

  it("rejects a discovery page number outside the safe range", () => {
    expect(() => buildEventListUrl(BASE_URL, APPROVED_HOST, 0)).toThrow(IngestionError);
    expect(() => buildEventListUrl(BASE_URL, APPROVED_HOST, 10_000)).toThrow(IngestionError);
  });

  it("rejects an invalid ID before ever constructing a URL", () => {
    expect(() => buildTeamUrl(BASE_URL, APPROVED_HOST, "../../etc/passwd")).toThrow(IngestionError);
  });
});

describe("assertApprovedUrl — SSRF protections", () => {
  const cases: readonly [string, string][] = [
    ["localhost", "https://localhost/team/1"],
    ["127.0.0.1", "https://127.0.0.1/team/1"],
    ["IPv6 localhost", "https://[::1]/team/1"],
    ["private network 10.x", "https://10.0.0.5/team/1"],
    ["private network 192.168.x", "https://192.168.1.1/team/1"],
    ["file URL", "file:///etc/passwd"],
    ["data URL", "data:text/html,<script>alert(1)</script>"],
    ["javascript URL", "javascript:alert(1)"],
    ["alternate domain", "https://evil.example.com/team/1"],
    ["deceptive subdomain", "https://www.vlr.gg.evil.com/team/1"],
    ["deceptive prefix", "https://evilwww.vlr.gg/team/1"],
    ["credentials embedded", "https://user:pass@www.vlr.gg/team/1"],
    ["alternate port", "https://www.vlr.gg:8443/team/1"],
    ["plain http", "http://www.vlr.gg/team/1"],
    ["protocol-relative treated as https host mismatch", "https://vlr.gg/team/1"],
  ];

  it.each(cases)("rejects %s", (_label, target) => {
    expect(() => assertApprovedUrl(new URL(target), APPROVED_HOST)).toThrow(IngestionError);
  });

  it("accepts the approved host over https with no credentials or port", () => {
    expect(() => assertApprovedUrl(new URL("https://www.vlr.gg/team/1"), APPROVED_HOST)).not.toThrow();
  });
});
