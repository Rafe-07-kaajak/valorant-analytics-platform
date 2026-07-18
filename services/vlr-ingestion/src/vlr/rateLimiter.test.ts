import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RequestRateLimiter } from "./rateLimiter";
import { IngestionError } from "../errors";

describe("RequestRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs a single task immediately", async () => {
    const limiter = new RequestRateLimiter({ maxConcurrency: 1, minIntervalMs: 2000 });
    const result = await limiter.schedule(async () => "done");
    expect(result).toBe("done");
  });

  it("never runs more than maxConcurrency tasks at once", async () => {
    const limiter = new RequestRateLimiter({ maxConcurrency: 2, minIntervalMs: 0 });
    let active = 0;
    let maxObservedActive = 0;

    const task = async () => {
      active += 1;
      maxObservedActive = Math.max(maxObservedActive, active);
      await new Promise((resolve) => setTimeout(resolve, 100));
      active -= 1;
    };

    const runs = [limiter.schedule(task), limiter.schedule(task), limiter.schedule(task)];
    await vi.runAllTimersAsync();
    await Promise.all(runs);

    expect(maxObservedActive).toBeLessThanOrEqual(2);
  });

  it("enforces the minimum interval between request starts", async () => {
    const limiter = new RequestRateLimiter({ maxConcurrency: 1, minIntervalMs: 2000 });
    const starts: number[] = [];

    const task = async () => {
      starts.push(Date.now());
    };

    const runs = [limiter.schedule(task), limiter.schedule(task)];
    await vi.runAllTimersAsync();
    await Promise.all(runs);

    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(2000);
  });

  it("rejects a queued acquisition when its signal is aborted", async () => {
    const limiter = new RequestRateLimiter({ maxConcurrency: 1, minIntervalMs: 5000 });
    const controller = new AbortController();

    const blocking = limiter.schedule(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
    });

    const aborted = limiter.schedule(async () => "should not run", controller.signal);
    aborted.catch(() => {}); // prevent an unhandled-rejection warning before the assertion below attaches its own handler
    controller.abort();

    await vi.runAllTimersAsync();
    await expect(aborted).rejects.toThrow(IngestionError);
    await blocking;
  });
});
