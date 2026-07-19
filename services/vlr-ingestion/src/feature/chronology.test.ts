import { describe, expect, it } from "vitest";
import { buildNormalizedMatch } from "../testUtils/normalizedMatchFixture";
import { groupMatchesChronologically } from "./chronology";

describe("groupMatchesChronologically", () => {
  it("sorts matches ascending by scheduledAt.iso regardless of input order", () => {
    const early = buildNormalizedMatch({ internalId: "vlr:match:early", scheduledAt: { iso: "2025-01-01T00:00:00.000Z", raw: "r", confidence: "high" } });
    const late = buildNormalizedMatch({ internalId: "vlr:match:late", scheduledAt: { iso: "2025-06-01T00:00:00.000Z", raw: "r", confidence: "high" } });
    const groups = groupMatchesChronologically([late, early]);
    expect(groups.map((g) => g.matches[0]!.internalId)).toEqual(["vlr:match:early", "vlr:match:late"]);
  });

  it("groups matches sharing the exact same scheduledAt.iso into one group", () => {
    const iso = "2025-01-01T00:00:00.000Z";
    const a = buildNormalizedMatch({ internalId: "vlr:match:1", scheduledAt: { iso, raw: "r", confidence: "high" } });
    const b = buildNormalizedMatch({ internalId: "vlr:match:2", scheduledAt: { iso, raw: "r", confidence: "high" } });
    const groups = groupMatchesChronologically([a, b]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.matches).toHaveLength(2);
  });

  it("breaks ties within a group deterministically by internalId", () => {
    const iso = "2025-01-01T00:00:00.000Z";
    const b = buildNormalizedMatch({ internalId: "vlr:match:2", scheduledAt: { iso, raw: "r", confidence: "high" } });
    const a = buildNormalizedMatch({ internalId: "vlr:match:1", scheduledAt: { iso, raw: "r", confidence: "high" } });
    const groups = groupMatchesChronologically([b, a]);
    expect(groups[0]!.matches.map((m) => m.internalId)).toEqual(["vlr:match:1", "vlr:match:2"]);
  });

  it("never mutates the input array", () => {
    const matches = [buildNormalizedMatch({ internalId: "vlr:match:2" }), buildNormalizedMatch({ internalId: "vlr:match:1" })];
    const copy = [...matches];
    groupMatchesChronologically(matches);
    expect(matches).toEqual(copy);
  });

  it("is deterministic across repeated calls with the same input", () => {
    const matches = [
      buildNormalizedMatch({ internalId: "vlr:match:2", scheduledAt: { iso: "2025-02-01T00:00:00.000Z", raw: "r", confidence: "high" } }),
      buildNormalizedMatch({ internalId: "vlr:match:1", scheduledAt: { iso: "2025-01-01T00:00:00.000Z", raw: "r", confidence: "high" } }),
    ];
    const first = groupMatchesChronologically(matches);
    const second = groupMatchesChronologically(matches);
    expect(first).toEqual(second);
  });
});
