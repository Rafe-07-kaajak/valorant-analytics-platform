import { mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LocalFilesystemArtifactSource } from "./artifactSource";
import { InferenceError } from "./errors";

async function makeDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "artifact-source-test-"));
}

describe("LocalFilesystemArtifactSource", () => {
  it("produces a safe, non-reversible directory identity that never contains the raw path", () => {
    const source = new LocalFilesystemArtifactSource("C:\\some\\developer\\machine\\path");
    const descriptor = source.describe();
    expect(descriptor.kind).toBe("local-filesystem");
    expect(descriptor.directoryId).toMatch(/^[a-f0-9]{16}$/);
    expect(descriptor.directoryId).not.toContain("developer");
  });

  it("lists only approved, present filenames — ignoring unapproved files", async () => {
    const dir = await makeDir();
    await writeFile(join(dir, "model.json"), "{}", "utf-8");
    await writeFile(join(dir, "not-an-artifact-file.txt"), "hello", "utf-8");
    const source = new LocalFilesystemArtifactSource(dir);
    const files = await source.listFiles();
    expect(files).toEqual(["model.json"]);
  });

  it("returns an empty file list for a directory that does not exist, rather than throwing", async () => {
    const source = new LocalFilesystemArtifactSource(join(tmpdir(), "does-not-exist-" + Date.now()));
    await expect(source.listFiles()).resolves.toEqual([]);
  });

  it("rejects reading a file name that is not on the approved allowlist", async () => {
    const dir = await makeDir();
    const source = new LocalFilesystemArtifactSource(dir);
    // @ts-expect-error deliberately passing an unapproved filename to prove the runtime check, not just the type check
    await expect(source.readFile("../../etc/passwd", 1000)).rejects.toBeInstanceOf(InferenceError);
  });

  it("rejects a symlinked file instead of following it", async () => {
    const dir = await makeDir();
    const realFile = join(dir, "real-target.json");
    await writeFile(realFile, "{}", "utf-8");
    const linkPath = join(dir, "model.json");
    try {
      await symlink(realFile, linkPath);
    } catch {
      // Symlink creation can require elevated privileges on some Windows
      // configurations; skip this assertion there rather than failing CI
      // for an environment limitation unrelated to the code under test.
      return;
    }
    const source = new LocalFilesystemArtifactSource(dir);
    const files = await source.listFiles();
    expect(files).not.toContain("model.json");
    await expect(source.readFile("model.json", 1000)).rejects.toBeInstanceOf(InferenceError);
  });

  it("enforces a per-file size limit before reading content into memory", async () => {
    const dir = await makeDir();
    await writeFile(join(dir, "model.json"), JSON.stringify({ padding: "x".repeat(1000) }), "utf-8");
    const source = new LocalFilesystemArtifactSource(dir);
    await expect(source.readFile("model.json", 10)).rejects.toMatchObject({ code: "payload_too_large" });
  });

  it("reads approved, appropriately-sized files successfully", async () => {
    const dir = await makeDir();
    await writeFile(join(dir, "model.json"), '{"estimatorType":"elo-baseline"}', "utf-8");
    const source = new LocalFilesystemArtifactSource(dir);
    const content = await source.readFile("model.json", 10_000);
    expect(JSON.parse(content)).toEqual({ estimatorType: "elo-baseline" });
  });
});
