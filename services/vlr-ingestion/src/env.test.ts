import { afterEach, describe, expect, it } from "vitest";
import { loadVlrIngestionConfig } from "./env";

const ENV_KEYS = [
  "VLR_NETWORK_ENABLED",
  "VLR_BASE_URL",
  "VLR_MIN_REQUEST_INTERVAL_MS",
  "VLR_MAX_CONCURRENCY",
  "VLR_REQUEST_TIMEOUT_MS",
  "VLR_MAX_RESPONSE_BYTES",
  "VLR_MAX_RETRIES",
] as const;

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("loadVlrIngestionConfig", () => {
  it("defaults network access to disabled", () => {
    expect(loadVlrIngestionConfig().networkEnabled).toBe(false);
  });

  it("clamps min request interval to a safe floor of 2000ms", () => {
    process.env.VLR_MIN_REQUEST_INTERVAL_MS = "10";
    expect(loadVlrIngestionConfig().minRequestIntervalMs).toBe(2000);
  });

  it("clamps concurrency to a safe ceiling of 4", () => {
    process.env.VLR_MAX_CONCURRENCY = "999";
    expect(loadVlrIngestionConfig().maxConcurrency).toBe(4);
  });

  it("clamps max retries to a safe ceiling of 5", () => {
    process.env.VLR_MAX_RETRIES = "9999";
    expect(loadVlrIngestionConfig().maxRetries).toBe(5);
  });

  it("clamps request timeout within [1000, 60000]", () => {
    process.env.VLR_REQUEST_TIMEOUT_MS = "1";
    expect(loadVlrIngestionConfig().requestTimeoutMs).toBe(1_000);
    process.env.VLR_REQUEST_TIMEOUT_MS = "999999";
    expect(loadVlrIngestionConfig().requestTimeoutMs).toBe(60_000);
  });

  it("ignores non-numeric overrides and falls back to the default", () => {
    process.env.VLR_MAX_CONCURRENCY = "not-a-number";
    expect(loadVlrIngestionConfig().maxConcurrency).toBe(1);
  });

  it("enables network access only on an explicit 'true' string", () => {
    process.env.VLR_NETWORK_ENABLED = "TRUE";
    expect(loadVlrIngestionConfig().networkEnabled).toBe(true);
    process.env.VLR_NETWORK_ENABLED = "yes";
    expect(loadVlrIngestionConfig().networkEnabled).toBe(false);
  });
});
