import { describe, expect, it } from "vitest";
import { contentHash, stripVolatileFields } from "./contentHash";

describe("contentHash", () => {
  it("is stable across repeated calls with the same input", () => {
    const value = { b: 2, a: 1 };
    expect(contentHash(value)).toBe(contentHash(value));
  });

  it("is identical regardless of object key order", () => {
    expect(contentHash({ a: 1, b: 2 })).toBe(contentHash({ b: 2, a: 1 }));
  });

  it("is identical regardless of nested key order", () => {
    const a = { outer: { x: 1, y: 2 } };
    const b = { outer: { y: 2, x: 1 } };
    expect(contentHash(a)).toBe(contentHash(b));
  });

  it("changes when the actual content changes", () => {
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }));
  });

  it("produces a 64-character hex sha256 digest", () => {
    expect(contentHash({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("stripVolatileFields", () => {
  it("removes only the named fields", () => {
    const stripped = stripVolatileFields({ id: "1", fetchedAt: "now", name: "x" }, ["fetchedAt"]);
    expect(stripped).toEqual({ id: "1", name: "x" });
  });

  it("makes hashes of otherwise-identical fetches match once volatile fields are stripped", () => {
    const first = stripVolatileFields({ id: "1", fetchedAt: "t1", value: 42 }, ["fetchedAt"]);
    const second = stripVolatileFields({ id: "1", fetchedAt: "t2", value: 42 }, ["fetchedAt"]);
    expect(contentHash(first)).toBe(contentHash(second));
  });
});
