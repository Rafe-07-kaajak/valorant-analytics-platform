import { describe, expect, it, vi } from "vitest";
import { VlrHttpClient } from "./httpClient";
import { IngestionError } from "../errors";
import type { VlrIngestionConfig } from "../env";

function testConfig(overrides: Partial<VlrIngestionConfig> = {}): VlrIngestionConfig {
  return {
    networkEnabled: true,
    baseUrl: "https://www.vlr.gg",
    approvedHost: "www.vlr.gg",
    minRequestIntervalMs: 0,
    maxConcurrency: 1,
    requestTimeoutMs: 5_000,
    maxResponseBytes: 1_000,
    maxRetries: 2,
    rawHtmlStorageEnabled: false,
    dataDir: ".local/vlr-data-test",
    backfillStartDate: "2025-01-01",
    contact: undefined,
    ...overrides,
  };
}

function htmlResponse(body: string, init?: ResponseInit): Response {
  return new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" }, ...init });
}

describe("VlrHttpClient — network kill switch", () => {
  it("refuses to fetch when networkEnabled is false", async () => {
    const client = new VlrHttpClient(testConfig({ networkEnabled: false }));
    await expect(client.fetchHtml(new URL("https://www.vlr.gg/team/1"))).rejects.toMatchObject({ code: "network_disabled" });
  });

  it("never invokes the underlying fetch implementation when disabled", async () => {
    const fetchImpl = vi.fn();
    const client = new VlrHttpClient(testConfig({ networkEnabled: false }), fetchImpl as unknown as typeof fetch);
    await expect(client.fetchHtml(new URL("https://www.vlr.gg/team/1"))).rejects.toThrow(IngestionError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("VlrHttpClient — success path", () => {
  it("returns the HTML body on a 200 text/html response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(htmlResponse("<html>ok</html>"));
    const client = new VlrHttpClient(testConfig(), fetchImpl as unknown as typeof fetch);
    const result = await client.fetchHtml(new URL("https://www.vlr.gg/team/1"));
    expect(result.html).toBe("<html>ok</html>");
    expect(result.status).toBe(200);
  });

  it("sends a descriptive User-Agent", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(htmlResponse("<html></html>"));
    const client = new VlrHttpClient(testConfig({ contact: "team@example.com" }), fetchImpl as unknown as typeof fetch);
    await client.fetchHtml(new URL("https://www.vlr.gg/team/1"));
    const requestInit = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    const headers = requestInit.headers as Record<string, string>;
    expect(headers["user-agent"]).toContain("ValorantAnalyticsPlatform-Ingestion");
    expect(headers["user-agent"]).toContain("team@example.com");
  });
});

describe("VlrHttpClient — content type and size limits", () => {
  it("rejects a non-HTML content type", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 200, headers: { "content-type": "application/json" } }));
    const client = new VlrHttpClient(testConfig(), fetchImpl as unknown as typeof fetch);
    await expect(client.fetchHtml(new URL("https://www.vlr.gg/team/1"))).rejects.toMatchObject({ code: "invalid_content_type" });
  });

  it("rejects a response body exceeding the configured byte limit", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(htmlResponse("x".repeat(2_000)));
    const client = new VlrHttpClient(testConfig({ maxResponseBytes: 100 }), fetchImpl as unknown as typeof fetch);
    await expect(client.fetchHtml(new URL("https://www.vlr.gg/team/1"))).rejects.toMatchObject({ code: "response_too_large" });
  });

  it("rejects via declared content-length before reading the body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(htmlResponse("short", { headers: { "content-type": "text/html", "content-length": "5000" } }));
    const client = new VlrHttpClient(testConfig({ maxResponseBytes: 100 }), fetchImpl as unknown as typeof fetch);
    await expect(client.fetchHtml(new URL("https://www.vlr.gg/team/1"))).rejects.toMatchObject({ code: "response_too_large" });
  });
});

describe("VlrHttpClient — redirects", () => {
  it("follows a redirect that stays on the approved host", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "/team/1-canonical" } }))
      .mockResolvedValueOnce(htmlResponse("<html>final</html>"));
    const client = new VlrHttpClient(testConfig(), fetchImpl as unknown as typeof fetch);
    const result = await client.fetchHtml(new URL("https://www.vlr.gg/team/1"));
    expect(result.html).toBe("<html>final</html>");
    expect(result.finalUrl).toBe("https://www.vlr.gg/team/1-canonical");
  });

  it("rejects a redirect that escapes the approved host", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://evil.example.com/steal" } }));
    const client = new VlrHttpClient(testConfig(), fetchImpl as unknown as typeof fetch);
    await expect(client.fetchHtml(new URL("https://www.vlr.gg/team/1"))).rejects.toMatchObject({ code: "disallowed_url" });
  });
});

describe("VlrHttpClient — retry and rate-limit classification", () => {
  it("retries a 503 and then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(htmlResponse("<html>recovered</html>"));
    const client = new VlrHttpClient(testConfig({ maxRetries: 2 }), fetchImpl as unknown as typeof fetch);
    const result = await client.fetchHtml(new URL("https://www.vlr.gg/team/1"));
    expect(result.html).toBe("<html>recovered</html>");
    expect(result.attempts).toBe(2);
  });

  it("respects Retry-After when present on a 429", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(htmlResponse("<html>ok</html>"));
    const client = new VlrHttpClient(testConfig(), fetchImpl as unknown as typeof fetch);
    const result = await client.fetchHtml(new URL("https://www.vlr.gg/team/1"));
    expect(result.html).toBe("<html>ok</html>");
  });

  it("does not retry a non-retryable 404", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    const client = new VlrHttpClient(testConfig({ maxRetries: 2 }), fetchImpl as unknown as typeof fetch);
    await expect(client.fetchHtml(new URL("https://www.vlr.gg/team/1"))).rejects.toMatchObject({ code: "unexpected_status" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("stops retrying once maxRetries is exhausted", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    const client = new VlrHttpClient(testConfig({ maxRetries: 1 }), fetchImpl as unknown as typeof fetch);
    await expect(client.fetchHtml(new URL("https://www.vlr.gg/team/1"))).rejects.toMatchObject({ code: "unexpected_status" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe("VlrHttpClient — cancellation", () => {
  it("rejects with a cancellation error when the caller's signal is already aborted", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(htmlResponse("<html></html>"));
    const client = new VlrHttpClient(testConfig(), fetchImpl as unknown as typeof fetch);
    const controller = new AbortController();
    controller.abort();
    await expect(client.fetchHtml(new URL("https://www.vlr.gg/team/1"), { signal: controller.signal })).rejects.toMatchObject({
      code: "cancelled",
    });
  });
});
