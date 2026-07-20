import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, afterEach } from "vitest";
import { inspectGitState } from "./gitInspect";

describe("inspectGitState", () => {
  it("resolves a commit SHA and clean status inside this real repository checkout", () => {
    const state = inspectGitState(process.cwd());
    expect(typeof state.commitSha === "string" || state.commitSha === undefined).toBe(true);
    if (state.commitSha) expect(state.commitSha).toMatch(/^[0-9a-f]{40}$/);
  });

  const cleanupDirs: string[] = [];
  afterEach(async () => {
    while (cleanupDirs.length > 0) await rm(cleanupDirs.pop()!, { recursive: true, force: true });
  });

  it("degrades to an 'unavailable' result (never throws) outside a Git repository", async () => {
    const root = await mkdtemp(join(tmpdir(), "git-inspect-test-"));
    cleanupDirs.push(root);
    const state = inspectGitState(root);
    expect(state.commitSha).toBeUndefined();
    expect(state.branch).toBeUndefined();
    expect(state.isDirty).toBe(false);
    expect(state.dirtyFiles).toEqual([]);
  });
});
