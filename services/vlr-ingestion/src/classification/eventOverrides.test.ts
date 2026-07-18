import { describe, expect, it } from "vitest";
import { buildOverrideLookup, validateOverrideRegistry } from "./eventOverrides";
import type { EventClassificationOverride } from "./eventOverrides";

describe("validateOverrideRegistry", () => {
  it("accepts a well-formed registry with no conflicts", () => {
    const entries: EventClassificationOverride[] = [
      { providerEventId: "100", classification: "masters", reason: "Verified from VLR event page metadata." },
      { providerEventId: "101", classification: "excluded-showmatch", reason: "All-star exhibition, not a ranked event." },
    ];
    const result = validateOverrideRegistry(entries);
    expect(result.valid).toBe(true);
    expect(result.conflicts).toHaveLength(0);
  });

  it("rejects an entry with an empty providerEventId", () => {
    const result = validateOverrideRegistry([{ providerEventId: "", classification: "masters", reason: "x" }]);
    expect(result.valid).toBe(false);
    expect(result.invalidEntries).toHaveLength(1);
  });

  it("rejects an entry with an unrecognized classification value", () => {
    const result = validateOverrideRegistry([
      { providerEventId: "1", classification: "not-a-real-classification" as never, reason: "x" },
    ]);
    expect(result.valid).toBe(false);
  });

  it("rejects an entry missing a reason", () => {
    const result = validateOverrideRegistry([{ providerEventId: "1", classification: "masters", reason: "" }]);
    expect(result.valid).toBe(false);
  });

  it("detects conflicting overrides for the same provider event ID", () => {
    const result = validateOverrideRegistry([
      { providerEventId: "1", classification: "masters", reason: "a" },
      { providerEventId: "1", classification: "champions", reason: "b" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]?.providerEventId).toBe("1");
  });

  it("does not treat repeated identical entries as a conflict", () => {
    const result = validateOverrideRegistry([
      { providerEventId: "1", classification: "masters", reason: "a" },
      { providerEventId: "1", classification: "masters", reason: "a" },
    ]);
    expect(result.valid).toBe(true);
    expect(result.conflicts).toHaveLength(0);
  });
});

describe("buildOverrideLookup", () => {
  it("builds a lookup keyed by providerEventId", () => {
    const lookup = buildOverrideLookup([{ providerEventId: "7", classification: "champions", reason: "verified" }]);
    expect(lookup.get("7")?.classification).toBe("champions");
    expect(lookup.get("missing")).toBeUndefined();
  });
});
