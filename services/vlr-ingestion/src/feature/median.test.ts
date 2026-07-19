import { describe, expect, it } from "vitest";
import { RunningMedianTracker } from "./median";

describe("RunningMedianTracker", () => {
  it("returns the fallback when nothing has been observed yet", () => {
    const tracker = new RunningMedianTracker();
    expect(tracker.median(1500)).toBe(1500);
  });

  it("computes the median of an odd number of observations", () => {
    const tracker = new RunningMedianTracker();
    [10, 30, 20].forEach((v) => tracker.push(v));
    expect(tracker.median(0)).toBe(20);
  });

  it("computes the median of an even number of observations as the average of the two middle values", () => {
    const tracker = new RunningMedianTracker();
    [10, 20, 30, 40].forEach((v) => tracker.push(v));
    expect(tracker.median(0)).toBe(25);
  });

  it("only reflects values pushed so far — later pushes don't affect an earlier read", () => {
    const tracker = new RunningMedianTracker();
    tracker.push(10);
    tracker.push(20);
    const medianBeforeThirdPush = tracker.median(0);
    tracker.push(1000);
    expect(medianBeforeThirdPush).toBe(15);
  });
});
