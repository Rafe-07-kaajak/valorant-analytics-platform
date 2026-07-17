import { describe, expect, it } from "vitest";
import { classifyDifference, PERCENT_SCALE_THRESHOLDS, ROUND_DIFFERENTIAL_THRESHOLDS } from "./thresholds";

describe("classifyDifference — percent scale (default)", () => {
  it("classifies an identical pair as even/none", () => {
    expect(classifyDifference(70, 70)).toEqual({ advantage: "even", tier: "none", magnitude: 0 });
  });

  it("keeps a gap just under the slight threshold as even/none", () => {
    const result = classifyDifference(70, 70 + PERCENT_SCALE_THRESHOLDS.slight - 0.1);
    expect(result.tier).toBe("none");
    expect(result.advantage).toBe("even");
  });

  it("classifies a gap at the slight boundary as slight, favoring the higher value", () => {
    const result = classifyDifference(70 + PERCENT_SCALE_THRESHOLDS.slight, 70);
    expect(result.tier).toBe("slight");
    expect(result.advantage).toBe("A");
  });

  it("classifies a gap at the moderate boundary as moderate", () => {
    const result = classifyDifference(70, 70 + PERCENT_SCALE_THRESHOLDS.moderate);
    expect(result.tier).toBe("moderate");
    expect(result.advantage).toBe("B");
  });

  it("classifies a gap at the strong boundary as strong", () => {
    const result = classifyDifference(70 + PERCENT_SCALE_THRESHOLDS.strong, 70);
    expect(result.tier).toBe("strong");
    expect(result.advantage).toBe("A");
  });

  it("never declares an advantage when the tier is none, regardless of which raw value is larger", () => {
    const higherFirst = classifyDifference(70.5, 70);
    const higherSecond = classifyDifference(70, 70.5);
    expect(higherFirst.advantage).toBe("even");
    expect(higherSecond.advantage).toBe("even");
  });

  it("rounds magnitude to one decimal place", () => {
    expect(classifyDifference(70.123, 70).magnitude).toBe(0.1);
  });
});

describe("classifyDifference — round-differential scale", () => {
  it("uses the narrower band so a 1-round gap reads as a real edge, not noise", () => {
    const result = classifyDifference(2, 1, ROUND_DIFFERENTIAL_THRESHOLDS);
    expect(result.tier).not.toBe("none");
  });

  it("keeps a 0.2-round gap as even/none", () => {
    const result = classifyDifference(1.2, 1, ROUND_DIFFERENTIAL_THRESHOLDS);
    expect(result.tier).toBe("none");
  });

  it("classifies a 4-round gap as strong", () => {
    const result = classifyDifference(4, 0, ROUND_DIFFERENTIAL_THRESHOLDS);
    expect(result.tier).toBe("strong");
  });
});
