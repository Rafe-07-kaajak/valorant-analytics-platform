import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, afterEach } from "vitest";
import { auditBundleSecurity } from "./bundleSecurityAudit";
import { ReleaseError, isReleaseError } from "../releaseErrors";

const cleanupDirs: string[] = [];
afterEach(async () => {
  while (cleanupDirs.length > 0) await rm(cleanupDirs.pop()!, { recursive: true, force: true });
});

async function makeBundleDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "bundle-security-test-"));
  cleanupDirs.push(root);
  return root;
}

describe("auditBundleSecurity", () => {
  it("throws release_bundle_missing for a nonexistent directory", async () => {
    await expect(auditBundleSecurity("/definitely/does/not/exist")).rejects.toSatisfy((error: unknown) => isReleaseError(error) && (error as ReleaseError).code === "release_bundle_missing");
  });

  it("returns no findings for an empty, valid directory", async () => {
    const root = await makeBundleDir();
    expect(await auditBundleSecurity(root)).toEqual([]);
  });

  it("flags a file not on the allowlist", async () => {
    const root = await makeBundleDir();
    await writeFile(join(root, "release-manifest.json"), "{}", "utf-8");
    await writeFile(join(root, "unexpected-binary.bin"), "junk", "utf-8");
    const findings = await auditBundleSecurity(root);
    expect(findings.some((finding) => finding.code === "release_forbidden_file" && finding.path === "unexpected-binary.bin")).toBe(true);
  });

  it("flags a forbidden filename like id_rsa", async () => {
    const root = await makeBundleDir();
    await writeFile(join(root, "id_rsa"), "not a real key", "utf-8");
    const findings = await auditBundleSecurity(root);
    expect(findings.some((finding) => finding.code === "release_forbidden_file" && finding.path === "id_rsa")).toBe(true);
  });

  it("flags a .pem extension", async () => {
    const root = await makeBundleDir();
    await writeFile(join(root, "cert.pem"), "not a real cert", "utf-8");
    const findings = await auditBundleSecurity(root);
    expect(findings.some((finding) => finding.code === "release_forbidden_file" && finding.path === "cert.pem")).toBe(true);
  });

  it("flags a private-key-shaped secret pattern inside an otherwise-allowlisted file", async () => {
    const root = await makeBundleDir();
    await writeFile(join(root, "release-manifest.json"), "-----BEGIN RSA PRIVATE KEY-----\nMIIExampleKeyMaterial\n-----END RSA PRIVATE KEY-----\n", "utf-8");
    const findings = await auditBundleSecurity(root);
    expect(findings.some((finding) => finding.code === "release_secret_detected")).toBe(true);
  });

  it("flags a __proto__ key inside a JSON file (prototype-pollution guard)", async () => {
    const root = await makeBundleDir();
    await writeFile(join(root, "manifest.json"), '{"__proto__": {"polluted": true}}', "utf-8");
    const findings = await auditBundleSecurity(root);
    expect(findings.some((finding) => finding.code === "release_unsafe_path" && finding.reason.includes("__proto__"))).toBe(true);
  });

  it("flags an embedded Windows absolute path inside a text file", async () => {
    const root = await makeBundleDir();
    await writeFile(join(root, "next.config.ts"), 'export default { root: "C:\\\\Users\\\\dev\\\\project" };\n', "utf-8");
    const findings = await auditBundleSecurity(root);
    expect(findings.some((finding) => finding.code === "release_unsafe_path")).toBe(true);
  });

  it("flags a symlink rather than following it", async () => {
    const root = await makeBundleDir();
    await writeFile(join(root, "package.json"), "{}", "utf-8");
    try {
      await symlink(join(root, "package.json"), join(root, "linked.json"));
    } catch {
      return; // symlink creation may require elevated privileges on this host; skip rather than fail spuriously
    }
    const findings = await auditBundleSecurity(root);
    expect(findings.some((finding) => finding.code === "release_symlink_rejected")).toBe(true);
  });

  it("walks nested directories (e.g. app/, runtime-package/model/)", async () => {
    const root = await makeBundleDir();
    await mkdir(join(root, "app"), { recursive: true });
    await writeFile(join(root, "app", "unexpected.sh"), "#!/bin/sh\n", "utf-8");
    const findings = await auditBundleSecurity(root);
    expect(findings.some((finding) => finding.path === "app/unexpected.sh")).toBe(true);
  });
});
