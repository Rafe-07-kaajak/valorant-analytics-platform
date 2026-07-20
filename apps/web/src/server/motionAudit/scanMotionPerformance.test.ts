import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { scanMotionPerformance } from "./scanMotionPerformance";

const repoRoot = resolve(__dirname, "../../../../..");

describe("scanMotionPerformance — TASK-051 static performance audit", () => {
  it("passes cleanly on this repository's own new motion module", () => {
    const report = scanMotionPerformance(repoRoot);
    expect(report.violations).toEqual([]);
    expect(report.filesScanned).toBeGreaterThan(0);
  });
});
