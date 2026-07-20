import { RELEASE_RULES_VERSION } from "./releaseRulesVersion";
import { computeReleaseVersion } from "./releaseVersion";
import type { FingerprintFileEntry } from "./sourceFingerprint";

/**
 * Release manifest contract — TASK-049 section 5. A pure builder: every
 * input (Git state, application fingerprint, lockfile hash, the already
 * loaded/validated runtime package manifest, verification results) is
 * computed by a caller (`bundleBuilder.ts`) and passed in here, so this
 * module never touches the filesystem and is trivially unit-testable.
 */

export const RELEASE_SUPPORTED_TARGETS = ["local-node-server", "generic-linux-vm", "container-docker", "ci-artifact-handoff", "manual-operator-deployment"] as const;
export const RELEASE_CONDITIONAL_TARGETS = ["serverless-function", "nextjs-standalone"] as const;
export const RELEASE_UNSUPPORTED_TARGETS = ["edge-runtime", "static-hosting"] as const;

export interface ReleaseFileEntry {
  readonly fileName: string;
  readonly sha256: string;
  readonly sizeBytes: number;
}

export interface ReleaseSizeSummary {
  readonly applicationTotalBytes: number;
  readonly runtimePackageTotalBytes: number;
  readonly configTotalBytes: number;
  readonly grandTotalBytes: number;
}

export interface ReleaseSecurityAssertions {
  readonly noSecretsDetected: boolean;
  readonly noAbsolutePaths: boolean;
  readonly noRawFeatureData: boolean;
  readonly noRawLabels: boolean;
  readonly allowlistEnforced: boolean;
}

/** `performed: false` (rather than a fabricated pass) is the honest default — TASK-049's "no unverified claims" requirement. */
export interface ReleaseVerificationSummary {
  readonly performed: boolean;
  readonly lintPassed?: boolean;
  readonly typecheckPassed?: boolean;
  readonly testsPassed?: boolean;
  readonly buildPassed?: boolean;
  readonly durationMs?: number;
}

export interface ReleaseRollbackCompatibilityMetadata {
  readonly previousReleaseVersion?: string;
  readonly rollbackCompatible: boolean | null;
}

export interface ReleaseManifest {
  readonly releaseRulesVersion: string;
  readonly releaseVersion: string;
  readonly generatedAt: string;
  readonly sourceCommitSha?: string;
  readonly sourceBranch?: string;
  readonly applicationBuildFingerprint: string;
  readonly applicationFramework: "next.js";
  readonly nodeVersionRequirement: string;
  readonly pnpmVersion: string;
  readonly lockfileHash: string;
  readonly runtimePackageVersion: string;
  readonly modelVersion: string;
  readonly estimatorType: string;
  readonly calibrationMethod: string;
  readonly sourceFeatureDatasetVersion: string;
  readonly featureSchemaVersion: string;
  readonly featureRulesVersion: string;
  readonly supportedRuntimeTargets: readonly string[];
  readonly conditionalRuntimeTargets: readonly string[];
  readonly unsupportedRuntimeTargets: readonly string[];
  readonly applicationFiles: readonly ReleaseFileEntry[];
  readonly runtimePackageFiles: readonly ReleaseFileEntry[];
  readonly configSchemaVersion: string;
  readonly sizeSummaryBytes: ReleaseSizeSummary;
  readonly securityAssertions: ReleaseSecurityAssertions;
  readonly testVerificationSummary: ReleaseVerificationSummary;
  readonly buildVerificationSummary: ReleaseVerificationSummary;
  readonly rollbackCompatibilityMetadata: ReleaseRollbackCompatibilityMetadata;
}

export interface BuildReleaseManifestInputs {
  readonly sourceCommitSha: string | undefined;
  readonly sourceBranch: string | undefined;
  readonly applicationFingerprint: string;
  readonly applicationFiles: readonly FingerprintFileEntry[];
  readonly nodeVersionRequirement: string;
  readonly pnpmVersion: string;
  readonly lockfileHash: string;
  readonly runtimePackageVersion: string;
  readonly modelVersion: string;
  readonly estimatorType: string;
  readonly calibrationMethod: string;
  readonly sourceFeatureDatasetVersion: string;
  readonly featureSchemaVersion: string;
  readonly featureRulesVersion: string;
  readonly runtimePackageFiles: readonly ReleaseFileEntry[];
  readonly configSchemaVersion: string;
  readonly runtimePackageTotalBytes: number;
  readonly configTotalBytes: number;
  readonly securityAssertions: ReleaseSecurityAssertions;
  readonly testVerificationSummary?: ReleaseVerificationSummary;
  readonly buildVerificationSummary?: ReleaseVerificationSummary;
  readonly previousReleaseVersion?: string;
  readonly rollbackCompatible?: boolean | null;
}

export function buildReleaseManifest(inputs: BuildReleaseManifestInputs): ReleaseManifest {
  const releaseVersion = computeReleaseVersion({
    sourceCommitSha: inputs.sourceCommitSha,
    runtimePackageVersion: inputs.runtimePackageVersion,
    modelVersion: inputs.modelVersion,
    sourceFeatureDatasetVersion: inputs.sourceFeatureDatasetVersion,
    applicationBuildFingerprint: inputs.applicationFingerprint,
    releaseRulesVersion: RELEASE_RULES_VERSION,
    lockfileHash: inputs.lockfileHash,
    configSchemaVersion: inputs.configSchemaVersion,
  });

  const applicationTotalBytes = inputs.applicationFiles.reduce((sum, file) => sum + file.sizeBytes, 0);
  const grandTotalBytes = applicationTotalBytes + inputs.runtimePackageTotalBytes + inputs.configTotalBytes;

  return {
    releaseRulesVersion: RELEASE_RULES_VERSION,
    releaseVersion,
    generatedAt: new Date().toISOString(),
    ...(inputs.sourceCommitSha ? { sourceCommitSha: inputs.sourceCommitSha } : {}),
    ...(inputs.sourceBranch ? { sourceBranch: inputs.sourceBranch } : {}),
    applicationBuildFingerprint: inputs.applicationFingerprint,
    applicationFramework: "next.js",
    nodeVersionRequirement: inputs.nodeVersionRequirement,
    pnpmVersion: inputs.pnpmVersion,
    lockfileHash: inputs.lockfileHash,
    runtimePackageVersion: inputs.runtimePackageVersion,
    modelVersion: inputs.modelVersion,
    estimatorType: inputs.estimatorType,
    calibrationMethod: inputs.calibrationMethod,
    sourceFeatureDatasetVersion: inputs.sourceFeatureDatasetVersion,
    featureSchemaVersion: inputs.featureSchemaVersion,
    featureRulesVersion: inputs.featureRulesVersion,
    supportedRuntimeTargets: [...RELEASE_SUPPORTED_TARGETS],
    conditionalRuntimeTargets: [...RELEASE_CONDITIONAL_TARGETS],
    unsupportedRuntimeTargets: [...RELEASE_UNSUPPORTED_TARGETS],
    applicationFiles: [...inputs.applicationFiles].map((file) => ({ fileName: file.path, sha256: file.sha256, sizeBytes: file.sizeBytes })).sort((a, b) => a.fileName.localeCompare(b.fileName)),
    runtimePackageFiles: [...inputs.runtimePackageFiles].sort((a, b) => a.fileName.localeCompare(b.fileName)),
    configSchemaVersion: inputs.configSchemaVersion,
    sizeSummaryBytes: { applicationTotalBytes, runtimePackageTotalBytes: inputs.runtimePackageTotalBytes, configTotalBytes: inputs.configTotalBytes, grandTotalBytes },
    securityAssertions: inputs.securityAssertions,
    testVerificationSummary: inputs.testVerificationSummary ?? { performed: false },
    buildVerificationSummary: inputs.buildVerificationSummary ?? { performed: false },
    rollbackCompatibilityMetadata: { ...(inputs.previousReleaseVersion ? { previousReleaseVersion: inputs.previousReleaseVersion } : {}), rollbackCompatible: inputs.rollbackCompatible ?? null },
  };
}
