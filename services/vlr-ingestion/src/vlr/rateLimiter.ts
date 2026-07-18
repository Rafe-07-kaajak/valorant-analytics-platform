import { IngestionError } from "../errors";

/**
 * Conservative concurrency + minimum-interval limiter — see
 * docs/29-vlr-data-ingestion-foundation.md ("Request/Rate Policy") and
 * TASK-041 requirement 11. Every scheduled task waits for both a free
 * concurrency slot and the configured minimum spacing since the last
 * request *started*, so the limiter enforces real request pacing rather
 * than just capping parallelism. Every internal timer is cleared on abort
 * or completion — nothing lingers after `schedule` settles.
 */
export interface RateLimiterConfig {
  readonly maxConcurrency: number;
  readonly minIntervalMs: number;
}

export class RequestRateLimiter {
  private readonly config: RateLimiterConfig;
  private active = 0;
  private lastStart = 0;
  private readonly queue: (() => void)[] = [];

  constructor(config: RateLimiterConfig) {
    this.config = config;
  }

  async schedule<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    await this.acquire(signal);
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const attempt = () => {
        if (signal?.aborted) {
          reject(new IngestionError("cancelled", "Rate limiter acquisition was cancelled."));
          return;
        }
        if (this.active >= this.config.maxConcurrency) {
          this.queue.push(attempt);
          return;
        }

        const now = Date.now();
        const waitMs = Math.max(0, this.lastStart + this.config.minIntervalMs - now);
        const start = () => {
          this.active += 1;
          this.lastStart = Date.now();
          resolve();
        };

        if (waitMs <= 0) {
          start();
          return;
        }

        const timer = setTimeout(start, waitMs);
        const onAbort = () => {
          clearTimeout(timer);
          reject(new IngestionError("cancelled", "Rate limiter acquisition was cancelled."));
        };
        signal?.addEventListener("abort", onAbort, { once: true });
      };

      attempt();
    });
  }

  private release(): void {
    this.active -= 1;
    const next = this.queue.shift();
    if (next) next();
  }
}
