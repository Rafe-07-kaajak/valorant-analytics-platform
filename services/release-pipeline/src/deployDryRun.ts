import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveSafePath } from "@repo/vlr-ingestion";
import { ReleaseError } from "./releaseErrors";
import type { ReleaseManifest } from "./manifest";
import type { RollbackManifest } from "./rollbackManifest";

/**
 * Deployment dry-run — TASK-049 section 13. Reads an already-built,
 * already-validated release bundle and produces a deployment *plan*: it
 * performs zero network requests, spawns no processes, and mutates
 * nothing outside its own return value. Every report explicitly states the
 * three "did not happen" facts the task requires, rather than leaving them
 * implied.
 */

export type DeploymentTarget = "local-node-server" | "generic-linux-vm" | "container-docker" | "ci-artifact-handoff" | "manual-operator-deployment";

export interface DeploymentStep {
  readonly order: number;
  readonly description: string;
}

export interface DeploymentPlan {
  readonly releaseVersion: string;
  readonly target: DeploymentTarget;
  readonly targetSupportLevel: "supported" | "conditional" | "unsupported";
  readonly runtimePackageMountPath: string;
  readonly startupSteps: readonly DeploymentStep[];
  readonly readinessUrl: string;
  readonly healthUrl: string;
  readonly rollbackTarget: string;
  readonly environmentCompatible: boolean;
  readonly environmentIssues: readonly string[];
  readonly postDeploymentVerificationSteps: readonly DeploymentStep[];
  readonly rollbackSteps: readonly DeploymentStep[];
  readonly disclaimers: readonly string[];
}

const DISCLAIMERS = ["No deployment occurred.", "No network request occurred.", "No credential was used.", "No external system was changed."] as const;

function supportLevelFor(manifest: ReleaseManifest, target: DeploymentTarget): "supported" | "conditional" | "unsupported" {
  if (manifest.supportedRuntimeTargets.includes(target)) return "supported";
  if (manifest.conditionalRuntimeTargets.includes(target)) return "conditional";
  return "unsupported";
}

export async function buildDeploymentPlan(bundleDir: string, target: DeploymentTarget = "local-node-server"): Promise<DeploymentPlan> {
  const root = resolveSafePath(bundleDir);
  let manifest: ReleaseManifest;
  let rollback: RollbackManifest;
  try {
    manifest = JSON.parse(await readFile(join(root, "release-manifest.json"), "utf-8")) as ReleaseManifest;
    rollback = JSON.parse(await readFile(join(root, "operations", "rollback-manifest.json"), "utf-8")) as RollbackManifest;
  } catch {
    throw new ReleaseError("release_bundle_missing", `Could not read a validated release bundle at "${bundleDir}". Run \`pnpm release:bundle:build\` (and \`release:bundle:validate\`) first.`);
  }

  const supportLevel = supportLevelFor(manifest, target);
  if (supportLevel === "unsupported") {
    throw new ReleaseError("release_target_unsupported", `Deployment target "${target}" is explicitly unsupported for release ${manifest.releaseVersion}.`, { details: { target } });
  }

  const environmentIssues: string[] = [];
  if (!manifest.sourceCommitSha) environmentIssues.push("Release manifest has no recorded sourceCommitSha — a deployment consumer cannot pin the exact application source.");

  return {
    releaseVersion: manifest.releaseVersion,
    target,
    targetSupportLevel: supportLevel,
    runtimePackageMountPath: "/app/runtime-package (read-only mount, per operations/deployment-spec.json)",
    startupSteps: [
      { order: 1, description: `Check out application source at commit ${manifest.sourceCommitSha ?? "(unrecorded)"}.` },
      { order: 2, description: "Run `pnpm install --frozen-lockfile` (lockfileHash: " + manifest.lockfileHash + ")." },
      { order: 3, description: "Run `pnpm --filter web build`." },
      { order: 4, description: "Mount the bundle's runtime-package/ directory read-only at the configured REAL_PREDICTION_RUNTIME_PACKAGE_DIR." },
      { order: 5, description: "Set REAL_PREDICTION_SOURCE_MODE=runtime-package, REAL_PREDICTION_REQUIRE_RUNTIME_PACKAGE=true, REAL_PREDICTION_EXPECTED_RUNTIME_PACKAGE_VERSION=" + manifest.runtimePackageVersion + "." },
      { order: 6, description: "Start with `pnpm --filter web start`." },
    ],
    readinessUrl: "/api/internal/prediction/readiness",
    healthUrl: "/api/internal/prediction/readiness",
    rollbackTarget: rollback.previousReleaseVersion ?? "(no previous release recorded)",
    environmentCompatible: environmentIssues.length === 0,
    environmentIssues,
    postDeploymentVerificationSteps: [
      { order: 1, description: "Call the readiness URL and confirm realPredictionAvailable / sourceMode / runtimePackageVersion match this release's manifest." },
      { order: 2, description: "Run `pnpm release:smoke:local` against the deployed environment." },
      { order: 3, description: "Confirm synthetic scenario mode still functions independent of real-mode status." },
    ],
    rollbackSteps: rollback.rollbackVerificationChecklist.map((description, index) => ({ order: index + 1, description })),
    disclaimers: [...DISCLAIMERS],
  };
}
