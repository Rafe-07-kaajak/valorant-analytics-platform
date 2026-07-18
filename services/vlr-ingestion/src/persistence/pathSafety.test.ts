import { describe, expect, it } from "vitest";
import { safeFileName, resolveSafePath } from "./pathSafety";
import { IngestionError } from "../errors";

describe("safeFileName", () => {
  it("replaces colons and slashes with underscores", () => {
    expect(safeFileName("vlr:team:2593")).toBe("vlr_team_2593");
    expect(safeFileName("a/b")).toBe("a_b");
  });

  it("is deterministic", () => {
    expect(safeFileName("vlr:match:1")).toBe(safeFileName("vlr:match:1"));
  });
});

describe("resolveSafePath", () => {
  const root = process.platform === "win32" ? "C:\\ingestion-root" : "/ingestion-root";

  it("resolves a normal nested path under the root", () => {
    expect(resolveSafePath(root, "raw", "team", "2593.json")).toContain("2593.json");
  });

  it("rejects a relative path-traversal segment", () => {
    expect(() => resolveSafePath(root, "..", "..", "etc", "passwd")).toThrow(IngestionError);
  });

  it("rejects an embedded traversal within a joined segment", () => {
    expect(() => resolveSafePath(root, "raw", "../../etc/passwd")).toThrow(IngestionError);
  });

  it("rejects an absolute path segment that would escape the root", () => {
    const escape = process.platform === "win32" ? "C:\\Windows\\System32" : "/etc";
    expect(() => resolveSafePath(root, escape)).toThrow(IngestionError);
  });
});
