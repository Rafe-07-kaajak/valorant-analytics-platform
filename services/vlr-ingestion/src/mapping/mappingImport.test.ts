import { describe, expect, it } from "vitest";
import { safeJsonParse, validateTeamMappingImport } from "./mappingImport";
import type { VlrTeamMappingEntry } from "../identity/teamMapping";

const CURRENT: readonly VlrTeamMappingEntry[] = [{ vlrTeamId: "1034", internalTeamId: "nrg", reason: "existing verified mapping" }];

describe("safeJsonParse", () => {
  it("parses well-formed JSON normally", () => {
    expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
  });

  it("rejects a __proto__ key to prevent prototype pollution", () => {
    expect(() => safeJsonParse('{"__proto__":{"polluted":true}}')).toThrow();
  });

  it("rejects a constructor key", () => {
    expect(() => safeJsonParse('{"constructor":{"polluted":true}}')).toThrow();
  });
});

describe("validateTeamMappingImport", () => {
  it("reports a brand-new entry as added", () => {
    const report = validateTeamMappingImport([{ vlrTeamId: "9999", internalTeamId: "furia", reason: "verified via team page" }], CURRENT);
    expect(report.added).toHaveLength(1);
    expect(report.valid).toBe(true);
  });

  it("rejects an entry that conflicts with an existing verified mapping for the same VLR ID", () => {
    const report = validateTeamMappingImport([{ vlrTeamId: "1034", internalTeamId: "100-thieves", reason: "conflicting claim" }], CURRENT);
    expect(report.rejected).toHaveLength(1);
    expect(report.valid).toBe(false);
  });

  it("reports an identical re-import of an existing entry as unchanged", () => {
    const report = validateTeamMappingImport([{ vlrTeamId: "1034", internalTeamId: "nrg", reason: "existing verified mapping" }], CURRENT);
    expect(report.unchanged).toHaveLength(1);
    expect(report.added).toHaveLength(0);
  });

  it("rejects two entries in the same payload that conflict with each other", () => {
    const report = validateTeamMappingImport(
      [
        { vlrTeamId: "5000", internalTeamId: "furia", reason: "a" },
        { vlrTeamId: "5000", internalTeamId: "loud", reason: "b" },
      ],
      CURRENT,
    );
    expect(report.rejected.length).toBeGreaterThan(0);
    expect(report.valid).toBe(false);
  });

  it("rejects a malformed entry missing required fields", () => {
    const report = validateTeamMappingImport([{ vlrTeamId: "5000" }], CURRENT);
    expect(report.rejected).toHaveLength(1);
    expect(report.valid).toBe(false);
  });

  it("rejects a top-level payload that isn't an array", () => {
    const report = validateTeamMappingImport({ not: "an array" }, CURRENT);
    expect(report.valid).toBe(false);
  });

  it("never mutates the current registry passed in", () => {
    const before = JSON.stringify(CURRENT);
    validateTeamMappingImport([{ vlrTeamId: "9999", internalTeamId: "furia", reason: "r" }], CURRENT);
    expect(JSON.stringify(CURRENT)).toBe(before);
  });
});
