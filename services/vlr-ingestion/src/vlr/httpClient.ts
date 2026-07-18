import type { VlrIngestionConfig } from "../env";
import { IngestionError } from "../errors";
import { RequestRateLimiter } from "./rateLimiter";
import { assertApprovedUrl } from "./urlBuilder";

/**
 * VLR HTTP client — see docs/29-vlr-data-ingestion-foundation.md ("HTTP
 * Client") and TASK-041 requirement 11. Node-only: imports nothing that
 * assumes a browser environment, uses only the platform `fetch`. Every
 * safety control (kill switch, rate limit, timeout, size limit, redirect
 * validation, retry policy) lives here so no caller can accidentally bypass
 * it by calling `fetch` directly.
 */

const MAX_REDIRECTS = 3;
const RETRYABLE_STATUS_CODES: ReadonlySet<number> = new Set([408, 425, 429, 500, 502, 503, 504]);
const USER_AGENT_PRODUCT = "ValorantAnalyticsPlatform-Ingestion/1.0";

export interface VlrHttpFetchResult {
  readonly html: string;
  readonly status: number;
  readonly finalUrl: string;
  readonly attempts: number;
}

function buildUserAgent(config: VlrIngestionConfig): string {
  const contact = config.contact ? ` (contact: ${config.contact})` : "";
  return `${USER_AGENT_PRODUCT}${contact}`;
}

function parseRetryAfterMs(headerValue: string | null): number | null {
  if (!headerValue) return null;
  const seconds = Number(headerValue);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(headerValue);
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
  return null;
}

function backoffWithJitterMs(attempt: number): number {
  const base = 250 * 2 ** attempt;
  const jitter = Math.random() * base * 0.25;
  return Math.min(10_000, base + jitter);
}

async function readBodyBounded(response: Response, maxBytes: number): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new IngestionError("response_too_large", `Response declared content-length ${contentLength} exceeds the ${maxBytes}-byte limit.`);
  }

  const reader = response.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new IngestionError("response_too_large", `Response body exceeded the ${maxBytes}-byte limit.`);
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf-8");
}

export class VlrHttpClient {
  private readonly config: VlrIngestionConfig;
  private readonly limiter: RequestRateLimiter;
  private readonly fetchImpl: typeof fetch;

  constructor(config: VlrIngestionConfig, fetchImpl: typeof fetch = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.limiter = new RequestRateLimiter({ maxConcurrency: config.maxConcurrency, minIntervalMs: config.minRequestIntervalMs });
  }

  /** Fetches an HTML page. Throws `network_disabled` unless `config.networkEnabled` is true. */
  async fetchHtml(url: URL, options?: { signal?: AbortSignal }): Promise<VlrHttpFetchResult> {
    if (!this.config.networkEnabled) {
      throw new IngestionError("network_disabled", "VLR_NETWORK_ENABLED is not true; refusing to perform a live network request.");
    }
    assertApprovedUrl(url, this.config.approvedHost);

    return this.limiter.schedule(() => this.fetchWithRetry(url, options?.signal), options?.signal);
  }

  private async fetchWithRetry(url: URL, callerSignal?: AbortSignal): Promise<VlrHttpFetchResult> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      try {
        return await this.fetchOnce(url, attempt, callerSignal);
      } catch (error) {
        lastError = error;
        const retryable = error instanceof IngestionError && (error.code === "timeout" || error.code === "rate_limited" || (error.code === "unexpected_status" && error.retryable));
        if (!retryable || attempt === this.config.maxRetries) throw error;

        const retryAfterMs = error instanceof IngestionError && typeof error.context?.retryAfterMs === "number" ? error.context.retryAfterMs : null;
        const delayMs = retryAfterMs ?? backoffWithJitterMs(attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw lastError;
  }

  private async fetchOnce(startUrl: URL, attempt: number, callerSignal?: AbortSignal): Promise<VlrHttpFetchResult> {
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(), this.config.requestTimeoutMs);
    const combinedSignal = callerSignal ? AbortSignal.any([callerSignal, timeoutController.signal]) : timeoutController.signal;

    try {
      let currentUrl = startUrl;
      for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
        let response: Response;
        try {
          response = await this.fetchImpl(currentUrl, {
            redirect: "manual",
            signal: combinedSignal,
            headers: { "user-agent": buildUserAgent(this.config), accept: "text/html" },
          });
        } catch (cause) {
          if (timeoutController.signal.aborted) {
            throw new IngestionError("timeout", `Request to ${currentUrl.toString()} timed out after ${this.config.requestTimeoutMs}ms.`);
          }
          if (callerSignal?.aborted) {
            throw new IngestionError("cancelled", "Request was cancelled.");
          }
          throw new IngestionError("unexpected_status", `Network error fetching ${currentUrl.toString()}: ${String(cause)}`, { retryable: true });
        }

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          if (!location) {
            throw new IngestionError("unexpected_status", `Redirect response from ${currentUrl.toString()} had no Location header.`);
          }
          const redirectUrl = new URL(location, currentUrl);
          assertApprovedUrl(redirectUrl, this.config.approvedHost);
          currentUrl = redirectUrl;
          continue;
        }

        if (response.status === 429 || RETRYABLE_STATUS_CODES.has(response.status)) {
          const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
          throw new IngestionError("unexpected_status", `Received retryable status ${response.status} from ${currentUrl.toString()}.`, {
            retryable: true,
            context: retryAfterMs !== null ? { retryAfterMs } : undefined,
          });
        }

        if (response.status !== 200) {
          throw new IngestionError("unexpected_status", `Received non-success status ${response.status} from ${currentUrl.toString()}.`);
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.toLowerCase().includes("text/html")) {
          throw new IngestionError("invalid_content_type", `Response content-type "${contentType}" is not text/html.`);
        }

        const html = await readBodyBounded(response, this.config.maxResponseBytes);
        return { html, status: response.status, finalUrl: currentUrl.toString(), attempts: attempt + 1 };
      }

      throw new IngestionError("unexpected_status", `Exceeded the maximum of ${MAX_REDIRECTS} redirects starting from ${startUrl.toString()}.`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
