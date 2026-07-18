import { describe, expect, it } from "vitest";
import { normalizeTeam } from "./normalizeTeam";
import type { VlrTeam } from "../vlr/schemas/raw";

const RAW: VlrTeam = {
  vlrTeamId: "2593",
  name: "Fnatic",
  shortName: "FNC",
  region: "United Kingdom",
  profileUrl: "https://www.vlr.gg/team/2593",
  source: { sourceUrl: "https://www.vlr.gg/team/2593", fetchedAt: "2026-07-18T00:00:00.000Z", parserVersion: "vlr-parsers@1.0.0" },
};

describe("normalizeTeam", () => {
  it("carries the resolved identity through", () => {
    const result = normalizeTeam(RAW, { internalId: "fnatic", mapped: true }, "2026-07-18T00:01:00.000Z");
    expect(result.internalId).toBe("fnatic");
    expect(result.mapped).toBe(true);
    expect(result.name).toBe("Fnatic");
  });

  it("preserves an unmapped identity's deterministic external ID", () => {
    const result = normalizeTeam(RAW, { internalId: "vlr:team:2593", mapped: false }, "2026-07-18T00:01:00.000Z");
    expect(result.internalId).toBe("vlr:team:2593");
    expect(result.mapped).toBe(false);
  });

  it("is idempotent: identical raw input and identity produce identical output", () => {
    const identity = { internalId: "fnatic", mapped: true };
    const first = normalizeTeam(RAW, identity, "2026-07-18T00:01:00.000Z");
    const second = normalizeTeam(RAW, identity, "2026-07-18T00:01:00.000Z");
    expect(first).toEqual(second);
  });

  it("produces the same contentHash for the same substantive content despite a different fetchedAt", () => {
    const identity = { internalId: "fnatic", mapped: true };
    const rawLater: VlrTeam = { ...RAW, source: { ...RAW.source, fetchedAt: "2026-07-19T00:00:00.000Z" } };
    const first = normalizeTeam(RAW, identity, "2026-07-18T00:01:00.000Z");
    const second = normalizeTeam(rawLater, identity, "2026-07-19T00:01:00.000Z");
    expect(first.metadata.contentHash).toBe(second.metadata.contentHash);
  });
});
