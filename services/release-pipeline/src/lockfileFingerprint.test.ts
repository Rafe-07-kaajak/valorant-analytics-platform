import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, afterEach } from "vitest";
import { computeLockfileHash } from "./lockfileFingerprint";

describe("computeLockfileHash", () => {
  const cleanupDirs: string[] = [];
  afterEach(async () => {
    while (cleanupDirs.length > 0) await rm(cleanupDirs.pop()!, { recursive: true, force: true });
  });

  it("is deterministic and changes with content", async () => {
    const root = await mkdtemp(join(tmpdir(), "lockfile-hash-test-"));
    cleanupDirs.push(root);
    const lockfilePath = join(root, "pnpm-lock.yaml");
    await writeFile(lockfilePath, "lockfileVersion: '9.0'\n", "utf-8");

    const first = await computeLockfileHash(lockfilePath);
    const second = await computeLockfileHash(lockfilePath);
    expect(second).toBe(first);

    await writeFile(lockfilePath, "lockfileVersion: '9.1'\n", "utf-8");
    const third = await computeLockfileHash(lockfilePath);
    expect(third).not.toBe(first);
  });
});
