import { describe, expect, it } from "vitest";
import { classifyEvent } from "./eventClassification";
import { buildOverrideLookup } from "./eventOverrides";
import type { ClassifiableEventInput } from "./eventClassification";

function event(overrides: Partial<ClassifiableEventInput>): ClassifiableEventInput {
  return { providerEventId: "1", name: "Untitled Event", ...overrides };
}

describe("classifyEvent — approved event families", () => {
  it("classifies VCT Americas from structured metadata", () => {
    const result = classifyEvent(event({ name: "VCT 2025: Americas Stage 1", parentSeries: "Champions Tour", region: "americas" }));
    expect(result.classification).toBe("vct-americas");
    expect(result.confidence).toBe("high");
  });

  it("classifies VCT EMEA from structured metadata", () => {
    const result = classifyEvent(event({ name: "VCT 2025: EMEA Stage 2", parentSeries: "Champions Tour", region: "emea" }));
    expect(result.classification).toBe("vct-emea");
  });

  it("classifies VCT Pacific from structured metadata", () => {
    const result = classifyEvent(event({ name: "VCT 2025: Pacific Stage 1", parentSeries: "Champions Tour", region: "pacific" }));
    expect(result.classification).toBe("vct-pacific");
  });

  it("classifies VCT China from structured metadata", () => {
    const result = classifyEvent(event({ name: "VCT 2025: China Stage 1", parentSeries: "Champions Tour", region: "china" }));
    expect(result.classification).toBe("vct-china");
  });

  it("classifies Masters from parent series metadata", () => {
    const result = classifyEvent(event({ name: "Masters Bangkok 2025", parentSeries: "VCT Masters" }));
    expect(result.classification).toBe("masters");
    expect(result.confidence).toBe("high");
  });

  it("classifies Champions from parent series metadata", () => {
    const result = classifyEvent(event({ name: "Valorant Champions 2025", parentSeries: "Champions" }));
    expect(result.classification).toBe("champions");
    expect(result.confidence).toBe("high");
  });
});

describe("classifyEvent — excluded categories", () => {
  it("excludes tier-2 events via a tag", () => {
    const result = classifyEvent(event({ name: "Regional Series", tags: ["tier-2"] }));
    expect(result.classification).toBe("excluded-tier-2");
  });

  it("excludes non-league qualifiers via name pattern", () => {
    const result = classifyEvent(event({ name: "VCT 2025: Americas Qualifier" }));
    expect(result.classification).toBe("excluded-qualifier");
  });

  it("excludes Game Changers events", () => {
    const result = classifyEvent(event({ name: "VCT Game Changers Championship 2025" }));
    expect(result.classification).toBe("excluded-game-changers");
  });

  it("excludes showmatches", () => {
    const result = classifyEvent(event({ name: "Community Showmatch: Legends Return" }));
    expect(result.classification).toBe("excluded-showmatch");
  });
});

describe("classifyEvent — unknown handling", () => {
  it("returns unknown with low confidence for unrelated events", () => {
    const result = classifyEvent(event({ name: "Local LAN Weekly #12" }));
    expect(result.classification).toBe("unknown");
    expect(result.confidence).toBe("low");
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it("never classifies an unrelated event as an approved family", () => {
    const result = classifyEvent(event({ name: "Charity Community Cup" }));
    expect(result.classification).not.toBe("masters");
    expect(result.classification).not.toBe("champions");
  });

  it("does not match 'masters' as a bare name-only substring — real third-party events misclassified during TASK-042 live discovery", () => {
    const result = classifyEvent(event({ name: "FunPay Clutch Masters" }));
    expect(result.classification).not.toBe("masters");
    const result2 = classifyEvent(event({ name: "POP Esports Masters Season 6" }));
    expect(result2.classification).not.toBe("masters");
    const result3 = classifyEvent(event({ name: "Shanghai Esports Masters 2025" }));
    expect(result3.classification).not.toBe("masters");
    // The genuine official naming convention still resolves at low confidence.
    const genuine = classifyEvent(event({ name: "Valorant Masters Bangkok 2025" }));
    expect(genuine.classification).toBe("masters");
  });

  it("does not match 'champions' as a substring of 'Championship' — a real event misclassified during TASK-042 live discovery", () => {
    const result = classifyEvent(event({ name: "HUTECH Esports Championship" }));
    expect(result.classification).not.toBe("champions");
    const result2 = classifyEvent(event({ name: "College VALORANT Championship 2026" }));
    expect(result2.classification).not.toBe("champions");
    const result3 = classifyEvent(event({ name: "ESSL Champions Cup 2026", parentSeries: "Champions Tour 2026" }));
    expect(result3.classification).not.toBe("champions");
  });
});

describe("classifyEvent — evidence and confidence", () => {
  it("flags name-only matches with low confidence and a provisional reason", () => {
    const result = classifyEvent(event({ name: "VCT Americas Kickoff" }));
    expect(result.confidence).toBe("low");
    expect(result.reason).toMatch(/provisional/i);
    expect(result.evidence[0]?.source).toBe("name-pattern");
  });

  it("prefers the override registry over name patterns and structured metadata", () => {
    const overrides = buildOverrideLookup([
      { providerEventId: "42", classification: "excluded-unrelated", reason: "Verified as an unrelated community event." },
    ]);
    const result = classifyEvent(event({ providerEventId: "42", name: "VCT Champions 2025", parentSeries: "Champions" }), overrides);
    expect(result.classification).toBe("excluded-unrelated");
    expect(result.confidence).toBe("authoritative");
  });
});
