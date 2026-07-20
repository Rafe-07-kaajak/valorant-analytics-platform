import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { dirname } from "node:path";
import { resolveSafePath, stableStringify } from "@repo/vlr-ingestion";
import { ReleaseError } from "./releaseErrors";
import { validateReleaseBundle } from "./bundleValidator";

/**
 * Runtime-package/release promotion state machine - TASK-049 section 7/14.
 * Only "candidate" -> "validated" -> "approved" are reachable; "deployed"
 * and "rolled-back" are explicitly rejected (no provider integration
 * exists yet). Promotion metadata is written to
 * `config.releaseStateDir/<releaseVersion>/promotion-manifest.json` -
 * deliberately *outside* the bundle directory, so approving a release
 * never mutates any of the bundle's own content-hashed files. Every call
 * appends to `history` rather than overwriting it, so a release's
 * promotion trail is never silently lost.
 */

export type PromotableState = "candidate" | "validated" | "approved";
const REJECTED_TARGET_STATES = new Set(["deployed", "rolled-back"]);

export interface PromotionHistoryEntry {
  readonly state: PromotableState;
  readonly at: string;
  readonly operator?: string;
  readonly dryRun?: boolean;
}

export interface PromotionRecord {
  readonly releaseVersion: string;
  readonly state: PromotableState;
  readonly history: readonly PromotionHistoryEntry[];
}

export interface PromoteReleaseOptions {
  readonly releaseStateDir: string;
  readonly bundleDir: string;
  readonly to: string;
  readonly operator?: string;
  readonly dryRun?: boolean;
}

/** Drops ASCII control characters (code points below 0x20, plus DEL) without relying on a control-character regex escape. */
function stripControlCharacters(value: string): string {
  let result = "";
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint >= 32 && codePoint !== 127) result += char;
  }
  return result;
}

function sanitizeOperator(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const stripped = stripControlCharacters(raw).trim().slice(0, 80);
  if (stripped.length === 0) return undefined;
  if (stripped.includes("@")) {
    throw new ReleaseError("release_config_invalid", "Operator metadata must be a name, not an email address or other personal identifier.");
  }
  return stripped;
}

async function readPromotionRecord(recordPath: string, releaseVersion: string): Promise<PromotionRecord> {
  const raw = await readFile(recordPath, "utf-8").catch(() => null);
  if (!raw) {
    return { releaseVersion, state: "candidate", history: [{ state: "candidate", at: new Date().toISOString() }] };
  }
  return JSON.parse(raw) as PromotionRecord;
}

async function writePromotionRecord(recordPath: string, record: PromotionRecord): Promise<void> {
  await mkdir(dirname(recordPath), { recursive: true });
  const tempPath = `${recordPath}.tmp-${randomBytes(6).toString("hex")}`;
  await writeFile(tempPath, stableStringify(record), "utf-8");
  await rename(tempPath, recordPath);
}

export async function promoteRelease(options: PromoteReleaseOptions): Promise<PromotionRecord> {
  if (REJECTED_TARGET_STATES.has(options.to) || (options.to !== "validated" && options.to !== "approved")) {
    throw new ReleaseError("release_invalid_transition", `Promotion target state "${options.to}" is not reachable - only "validated" and "approved" may be promoted to (deployment/rollback require future provider integration).`, { details: { to: options.to } });
  }
  const to = options.to as PromotableState;

  const bundleManifestPath = resolveSafePath(options.bundleDir, "release-manifest.json");
  const bundleManifestRaw = await readFile(bundleManifestPath, "utf-8").catch(() => null);
  if (!bundleManifestRaw) {
    throw new ReleaseError("release_bundle_missing", `No release bundle found at "${options.bundleDir}". Run \`pnpm release:bundle:build\` first.`);
  }
  const { releaseVersion } = JSON.parse(bundleManifestRaw) as { releaseVersion: string };

  const recordPath = resolveSafePath(options.releaseStateDir, releaseVersion, "promotion-manifest.json");
  const current = await readPromotionRecord(recordPath, releaseVersion);

  if (to === "validated") {
    if (current.state !== "candidate" && current.state !== "validated") {
      throw new ReleaseError("release_invalid_transition", `Cannot promote release ${releaseVersion} to "validated" from its current state "${current.state}".`, { details: { from: current.state, to } });
    }
    const validation = await validateReleaseBundle(options.bundleDir);
    if (!validation.valid) {
      throw new ReleaseError("release_invalid_transition", `Release ${releaseVersion} failed bundle validation and cannot be promoted to "validated": ${validation.errors[0] ?? "unknown validation error"}.`, { details: { errorCount: validation.errors.length } });
    }
  } else {
    if (current.state !== "validated" && current.state !== "approved") {
      throw new ReleaseError("release_invalid_transition", `Cannot promote release ${releaseVersion} to "approved" from its current state "${current.state}" - a release must be "validated" first.`, { details: { from: current.state, to } });
    }
    const operator = sanitizeOperator(options.operator);
    if (!operator && !options.dryRun) {
      throw new ReleaseError("release_invalid_transition", 'Promoting to "approved" requires either operator metadata or --dry-run.', { details: { from: current.state, to } });
    }
  }

  const operator = sanitizeOperator(options.operator);
  const record: PromotionRecord = {
    releaseVersion,
    state: to,
    history: [...current.history, { state: to, at: new Date().toISOString(), ...(operator ? { operator } : {}), ...(options.dryRun ? { dryRun: true } : {}) }],
  };
  await writePromotionRecord(recordPath, record);
  return record;
}

export async function getPromotionRecord(releaseStateDir: string, releaseVersion: string): Promise<PromotionRecord | undefined> {
  const recordPath = resolveSafePath(releaseStateDir, releaseVersion, "promotion-manifest.json");
  const raw = await readFile(recordPath, "utf-8").catch(() => null);
  return raw ? (JSON.parse(raw) as PromotionRecord) : undefined;
}
