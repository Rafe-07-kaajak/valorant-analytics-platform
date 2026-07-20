import { readFile, readdir, lstat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { RUNTIME_PACKAGE_HISTORICAL_FILENAMES, RUNTIME_PACKAGE_MANIFEST_FILENAME, RUNTIME_PACKAGE_MODEL_FILENAMES } from "@repo/model-inference";
import { ReleaseError } from "../releaseErrors";

/**
 * Independent security audit of an already-staged release bundle —
 * TASK-049 section 24. Deliberately re-walks the bundle tree from disk
 * rather than trusting `bundleBuilder.ts`'s in-memory file list, the same
 * "never trust the writer" posture `runtimePackage/loader.ts` takes toward
 * a built runtime package. Every finding maps to a specific `ReleaseError`
 * code so `bundleValidator.ts` can fail loudly with a stable reason rather
 * than a generic "invalid bundle."
 */

const ALLOWED_FILENAMES = new Set<string>(["package.json", "next.config.ts", "release-manifest.json", "source-manifest.json", "environment-schema.json", "environment-example.txt", "preflight-report.json", "smoke-test-definition.json", "rollback-manifest.json", RUNTIME_PACKAGE_MANIFEST_FILENAME, ...RUNTIME_PACKAGE_MODEL_FILENAMES, ...RUNTIME_PACKAGE_HISTORICAL_FILENAMES]);

const FORBIDDEN_EXACT_NAMES = new Set([".env", ".env.local", ".env.production", "id_rsa", "id_ed25519", ".npmrc", ".netrc"]);
const FORBIDDEN_EXTENSIONS = new Set([".pem", ".key", ".p12", ".pfx", ".crt"]);

// Heuristic, best-effort secret-shaped patterns — not an exhaustive secret
// scanner. A false negative here does not mean a bundle is safe; it means
// this specific pattern set did not fire.
const SECRET_PATTERNS: readonly RegExp[] = [/AKIA[0-9A-Z]{16}/, /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, /sk-[a-zA-Z0-9]{20,}/, /ghp_[a-zA-Z0-9]{30,}/];

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export interface BundleSecurityFinding {
  readonly code: "release_forbidden_file" | "release_unsafe_path" | "release_symlink_rejected" | "release_secret_detected";
  readonly path: string;
  readonly reason: string;
}

function toPosixRelative(root: string, absolutePath: string): string {
  return relative(root, absolutePath).split(sep).join("/");
}

function extensionOf(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex === -1 ? "" : fileName.slice(dotIndex).toLowerCase();
}

function scanForForbiddenKeys(value: unknown, path: string, findings: BundleSecurityFinding[]): void {
  if (Array.isArray(value)) {
    for (const entry of value) scanForForbiddenKeys(entry, path, findings);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const key of Object.getOwnPropertyNames(value)) {
      if (FORBIDDEN_KEYS.has(key)) {
        findings.push({ code: "release_unsafe_path", path, reason: `Contains a forbidden key "${key}" (prototype-pollution guard).` });
      }
      scanForForbiddenKeys((value as Record<string, unknown>)[key], path, findings);
    }
  }
}

function scanTextForSecretsAndAbsolutePaths(content: string, path: string, findings: BundleSecurityFinding[]): void {
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      findings.push({ code: "release_secret_detected", path, reason: "Content matches a secret-shaped pattern." });
      break;
    }
  }
  // Windows drive-letter absolute paths (`C:\...`) or POSIX-rooted absolute
  // paths embedded inside a *value* — matched conservatively so a relative
  // path like "config/example.env" never false-positives.
  if (/[A-Za-z]:\\[^"\s]+|"\/(?:home|Users|Projects|var|etc)\//.test(content)) {
    findings.push({ code: "release_unsafe_path", path, reason: "Content appears to contain an absolute local filesystem path." });
  }
}

async function walk(root: string, dir: string, findings: BundleSecurityFinding[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = join(dir, entry.name);
    const relPath = toPosixRelative(root, absolutePath);
    const entryStat = await lstat(absolutePath);

    if (entryStat.isSymbolicLink()) {
      findings.push({ code: "release_symlink_rejected", path: relPath, reason: "Symlinks are not permitted inside a release bundle." });
      continue;
    }
    if (entryStat.isDirectory()) {
      await walk(root, absolutePath, findings);
      continue;
    }
    if (!entryStat.isFile()) continue;

    if (FORBIDDEN_EXACT_NAMES.has(entry.name) || FORBIDDEN_EXTENSIONS.has(extensionOf(entry.name))) {
      findings.push({ code: "release_forbidden_file", path: relPath, reason: `File "${entry.name}" matches a forbidden filename/extension.` });
      continue;
    }
    if (!ALLOWED_FILENAMES.has(entry.name)) {
      findings.push({ code: "release_forbidden_file", path: relPath, reason: `File "${entry.name}" is not on the release bundle's file allowlist.` });
      continue;
    }

    const content = await readFile(absolutePath, "utf-8");
    scanTextForSecretsAndAbsolutePaths(content, relPath, findings);
    if (extensionOf(entry.name) === ".json") {
      try {
        scanForForbiddenKeys(JSON.parse(content), relPath, findings);
      } catch {
        findings.push({ code: "release_unsafe_path", path: relPath, reason: "File has a .json extension but is not valid JSON." });
      }
    }
  }
}

export async function auditBundleSecurity(bundleDir: string): Promise<readonly BundleSecurityFinding[]> {
  const rootStat = await lstat(bundleDir).catch(() => null);
  if (!rootStat || !rootStat.isDirectory()) {
    throw new ReleaseError("release_bundle_missing", "The release bundle directory does not exist.");
  }
  const findings: BundleSecurityFinding[] = [];
  await walk(bundleDir, bundleDir, findings);
  return findings;
}
