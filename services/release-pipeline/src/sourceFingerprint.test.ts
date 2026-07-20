import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, afterEach } from "vitest";
import { computeDirectoryFingerprint } from "./sourceFingerprint";
import { ReleaseError, isReleaseError } from "./releaseErrors";

async function makeFixtureDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "source-fingerprint-test-"));
  await mkdir(join(root, "src", "nested"), { recursive: true });
  await writeFile(join(root, "package.json"), '{"name":"fixture"}', "utf-8");
  await writeFile(join(root, "src", "a.ts"), "export const a = 1;\n", "utf-8");
  await writeFile(join(root, "src", "nested", "b.ts"), "export const b = 2;\n", "utf-8");
  return root;
}

describe("computeDirectoryFingerprint", () => {
  const cleanupDirs: string[] = [];
  afterEach(async () => {
    while (cleanupDirs.length > 0) await rm(cleanupDirs.pop()!, { recursive: true, force: true });
  });

  it("is deterministic across two calls against unchanged content", async () => {
    const root = await makeFixtureDir();
    cleanupDirs.push(root);
    const first = await computeDirectoryFingerprint(root, ["src", "package.json"]);
    const second = await computeDirectoryFingerprint(root, ["src", "package.json"]);
    expect(second.fingerprint).toBe(first.fingerprint);
    expect(second.files).toEqual(first.files);
  });

  it("changes when a file's content changes", async () => {
    const root = await makeFixtureDir();
    cleanupDirs.push(root);
    const before = await computeDirectoryFingerprint(root, ["src", "package.json"]);
    await writeFile(join(root, "src", "a.ts"), "export const a = 999;\n", "utf-8");
    const after = await computeDirectoryFingerprint(root, ["src", "package.json"]);
    expect(after.fingerprint).not.toBe(before.fingerprint);
  });

  it("changes when a file is added", async () => {
    const root = await makeFixtureDir();
    cleanupDirs.push(root);
    const before = await computeDirectoryFingerprint(root, ["src", "package.json"]);
    await writeFile(join(root, "src", "c.ts"), "export const c = 3;\n", "utf-8");
    const after = await computeDirectoryFingerprint(root, ["src", "package.json"]);
    expect(after.fingerprint).not.toBe(before.fingerprint);
    expect(after.files.length).toBe(before.files.length + 1);
  });

  it("is independent of directory walk order (sorted output)", async () => {
    const root = await makeFixtureDir();
    cleanupDirs.push(root);
    const result = await computeDirectoryFingerprint(root, ["package.json", "src"]);
    const paths = result.files.map((file) => file.path);
    expect(paths).toEqual([...paths].sort((a, b) => a.localeCompare(b)));
  });

  it("skips a missing target instead of throwing", async () => {
    const root = await makeFixtureDir();
    cleanupDirs.push(root);
    const result = await computeDirectoryFingerprint(root, ["src", "does-not-exist"]);
    expect(result.files.some((file) => file.path.startsWith("src/"))).toBe(true);
  });

  it("excludes node_modules/.next/.git even if present under a walked directory", async () => {
    const root = await makeFixtureDir();
    cleanupDirs.push(root);
    await mkdir(join(root, "src", "node_modules"), { recursive: true });
    await writeFile(join(root, "src", "node_modules", "junk.js"), "module.exports = {};\n", "utf-8");
    const result = await computeDirectoryFingerprint(root, ["src"]);
    expect(result.files.some((file) => file.path.includes("node_modules"))).toBe(false);
  });

  it("rejects a symlink rather than following it", async () => {
    const root = await makeFixtureDir();
    cleanupDirs.push(root);
    const linkPath = join(root, "src", "linked.ts");
    try {
      await symlink(join(root, "src", "a.ts"), linkPath);
    } catch {
      return; // symlink creation may require elevated privileges on this host; skip rather than fail spuriously
    }
    await expect(computeDirectoryFingerprint(root, ["src"])).rejects.toSatisfy((error: unknown) => isReleaseError(error) && (error as ReleaseError).code === "release_symlink_rejected");
  });
});
