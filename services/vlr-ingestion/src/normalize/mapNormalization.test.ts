import { describe, expect, it } from "vitest";
import { normalizeMapName } from "./mapNormalization";

describe("normalizeMapName", () => {
  it("normalizes a lowercase map name to its canonical capitalization", () => {
    expect(normalizeMapName("ascent")).toEqual({ name: "Ascent", raw: "ascent", recognized: true });
  });

  it("normalizes an all-caps map name", () => {
    expect(normalizeMapName("BIND")).toEqual({ name: "Bind", raw: "BIND", recognized: true });
  });

  it("trims incidental whitespace", () => {
    expect(normalizeMapName("  Lotus  ")).toEqual({ name: "Lotus", raw: "Lotus", recognized: true });
  });

  it("preserves an unrecognized map name verbatim and flags it", () => {
    const result = normalizeMapName("Corrode");
    expect(result.recognized).toBe(false);
    expect(result.name).toBe("Corrode");
  });

  it("never remaps an unknown map to a different known map", () => {
    const result = normalizeMapName("Unknown Map XYZ");
    expect(result.name).toBe("Unknown Map XYZ");
  });
});
