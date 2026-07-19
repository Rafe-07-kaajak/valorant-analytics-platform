import { describe, expect, it } from "vitest";

/**
 * Static audit — TASK-048 requirement 8/13. Every route under
 * `api/internal/prediction/**` reads a filesystem-backed model/data source
 * (directly or via `@repo/model-inference`) and must never run on the Edge
 * runtime, which has no Node filesystem API. This test imports each route
 * module directly and asserts its exported `runtime` marker is exactly
 * `"nodejs"` — a regression here would mean a future edit silently dropped
 * the marker (or added `export const runtime = "edge"`), which
 * `next build` would otherwise only catch at deploy time.
 */
describe("prediction API routes: explicit Node runtime marker", () => {
  it.each([
    ["catalog", () => import("./catalog/route")],
    ["historical", () => import("./historical/route")],
    ["readiness", () => import("./readiness/route")],
  ])("%s/route.ts declares runtime = \"nodejs\"", async (_name, load) => {
    const routeModule = await load();
    expect(routeModule.runtime).toBe("nodejs");
  });
});
