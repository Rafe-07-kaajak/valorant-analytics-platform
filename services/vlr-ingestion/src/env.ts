/**
 * Environment configuration for the VLR ingestion foundation — see
 * docs/29-vlr-data-ingestion-foundation.md ("Network Kill Switch",
 * "Request/Rate Policy"). Every bound is clamped between a safe minimum and
 * a safe maximum so misconfiguration cannot turn into an aggressive crawl;
 * see requirement 11 ("Default safety configuration should be conservative")
 * and requirement 12 (network kill switch) in TASK-041.
 *
 * Reading this module performs no network access and no filesystem writes —
 * only `process.env` lookups — so importing it is always safe during
 * `pnpm build`, `pnpm test`, and `pnpm dev`.
 */

const APPROVED_VLR_HOST = "www.vlr.gg";
const DEFAULT_BASE_URL = `https://${APPROVED_VLR_HOST}`;

function readBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw.trim().toLowerCase() === "true";
}

function readClampedInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export interface VlrIngestionConfig {
  /** Master kill switch. False unless explicitly enabled. */
  readonly networkEnabled: boolean;
  readonly baseUrl: string;
  readonly approvedHost: string;
  readonly minRequestIntervalMs: number;
  readonly maxConcurrency: number;
  readonly requestTimeoutMs: number;
  readonly maxResponseBytes: number;
  readonly maxRetries: number;
  readonly rawHtmlStorageEnabled: boolean;
  readonly dataDir: string;
  readonly backfillStartDate: string;
  readonly contact: string | undefined;
}

/**
 * Reads the current configuration from `process.env`, clamping every
 * numeric bound to a safe range. Called on demand (never cached at module
 * scope) so tests can mutate `process.env` between assertions.
 */
export function loadVlrIngestionConfig(): VlrIngestionConfig {
  return {
    networkEnabled: readBool("VLR_NETWORK_ENABLED", false),
    baseUrl: process.env.VLR_BASE_URL?.trim() || DEFAULT_BASE_URL,
    approvedHost: APPROVED_VLR_HOST,
    // Safe minimum: 2000ms. Safe maximum: 5 minutes, to keep the bound
    // meaningful rather than allowing an effectively-disabled limiter.
    minRequestIntervalMs: readClampedInt("VLR_MIN_REQUEST_INTERVAL_MS", 2000, 2000, 300_000),
    // Safe minimum/maximum: 1 to 4 concurrent requests.
    maxConcurrency: readClampedInt("VLR_MAX_CONCURRENCY", 1, 1, 4),
    // Safe minimum/maximum: 1s to 60s.
    requestTimeoutMs: readClampedInt("VLR_REQUEST_TIMEOUT_MS", 15_000, 1_000, 60_000),
    // Safe minimum/maximum: 100KB to 10MB.
    maxResponseBytes: readClampedInt("VLR_MAX_RESPONSE_BYTES", 2_000_000, 100_000, 10_000_000),
    // Safe minimum/maximum: 0 to 5 retries.
    maxRetries: readClampedInt("VLR_MAX_RETRIES", 2, 0, 5),
    rawHtmlStorageEnabled: readBool("VLR_RAW_HTML_STORAGE", false),
    dataDir: process.env.VLR_DATA_DIR?.trim() || ".local/vlr-data",
    backfillStartDate: process.env.VLR_BACKFILL_START_DATE?.trim() || "2025-01-01",
    contact: process.env.VLR_CONTACT?.trim() || undefined,
  };
}

/** Human-readable summary printed by every live CLI command before fetching. */
export function describeConfig(config: VlrIngestionConfig): string {
  return [
    `network enabled: ${config.networkEnabled}`,
    `base url: ${config.baseUrl}`,
    `min request interval: ${config.minRequestIntervalMs}ms`,
    `max concurrency: ${config.maxConcurrency}`,
    `request timeout: ${config.requestTimeoutMs}ms`,
    `max response bytes: ${config.maxResponseBytes}`,
    `max retries: ${config.maxRetries}`,
    `raw html storage: ${config.rawHtmlStorageEnabled}`,
    `data dir: ${config.dataDir}`,
  ].join("\n");
}
