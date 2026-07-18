import { describe, expect, it } from "vitest";
import { createQualityIssue, mergeQualityIssues, sortQualityIssues, summarizeQualityIssues } from "./qualityIssue";

describe("createQualityIssue", () => {
  it("applies the code's default severity when none is given", () => {
    const issue = createQualityIssue({ code: "invalid_score", entityType: "match", entityId: "vlr:match:1", message: "bad", detectedAt: "t1" });
    expect(issue.severity).toBe("fatal");
    expect(issue.resolutionStatus).toBe("open");
    expect(issue.firstDetectedAt).toBe("t1");
    expect(issue.latestDetectedAt).toBe("t1");
  });

  it("honors an explicit severity override", () => {
    const issue = createQualityIssue({ code: "unmapped_team", entityType: "team", entityId: "vlr:team:1", message: "m", detectedAt: "t1", severity: "warning" });
    expect(issue.severity).toBe("warning");
  });
});

describe("mergeQualityIssues", () => {
  it("preserves firstDetectedAt for a recurring issue and keeps the new latestDetectedAt", () => {
    const previous = [createQualityIssue({ code: "incomplete_roster", entityType: "match", entityId: "vlr:match:1", message: "m", detectedAt: "day1" })];
    const current = [createQualityIssue({ code: "incomplete_roster", entityType: "match", entityId: "vlr:match:1", message: "m", detectedAt: "day2" })];
    const merged = mergeQualityIssues(previous, current);
    expect(merged[0]!.firstDetectedAt).toBe("day1");
    expect(merged[0]!.latestDetectedAt).toBe("day2");
  });

  it("treats a genuinely new issue (different code/entity/field) as first-seen now", () => {
    const previous = [createQualityIssue({ code: "incomplete_roster", entityType: "match", entityId: "vlr:match:1", message: "m", detectedAt: "day1" })];
    const current = [createQualityIssue({ code: "unknown_map", entityType: "match", entityId: "vlr:match:1", message: "m", detectedAt: "day2" })];
    const merged = mergeQualityIssues(previous, current);
    expect(merged[0]!.firstDetectedAt).toBe("day2");
  });
});

describe("sortQualityIssues", () => {
  it("orders by severity (most severe first), then code, then entityId, deterministically", () => {
    const warning = createQualityIssue({ code: "unknown_map", entityType: "match", entityId: "b", message: "m", detectedAt: "t" });
    const fatal = createQualityIssue({ code: "invalid_score", entityType: "match", entityId: "a", message: "m", detectedAt: "t" });
    const sorted = sortQualityIssues([warning, fatal]);
    expect(sorted.map((i) => i.code)).toEqual(["invalid_score", "unknown_map"]);
  });

  it("produces the same order regardless of input order (deterministic)", () => {
    const a = createQualityIssue({ code: "unknown_map", entityType: "match", entityId: "a", message: "m", detectedAt: "t" });
    const b = createQualityIssue({ code: "unknown_map", entityType: "match", entityId: "b", message: "m", detectedAt: "t" });
    expect(sortQualityIssues([b, a])).toEqual(sortQualityIssues([a, b]));
  });
});

describe("summarizeQualityIssues", () => {
  it("buckets by severity, code, and resolution status", () => {
    const issues = [
      createQualityIssue({ code: "invalid_score", entityType: "match", entityId: "a", message: "m", detectedAt: "t" }),
      { ...createQualityIssue({ code: "invalid_score", entityType: "match", entityId: "b", message: "m", detectedAt: "t" }), resolutionStatus: "resolved" as const },
    ];
    const summary = summarizeQualityIssues(issues);
    expect(summary.totalIssues).toBe(2);
    expect(summary.bySeverity.fatal).toBe(2);
    expect(summary.byCode.invalid_score).toBe(2);
    expect(summary.openCount).toBe(1);
    expect(summary.resolvedCount).toBe(1);
  });
});
