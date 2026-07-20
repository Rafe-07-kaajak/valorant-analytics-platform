// Errors
export { ReleaseError, isReleaseError, toSafeReleaseError } from "./releaseErrors";
export type { ReleaseErrorCode, ReleaseErrorDetails, SafeReleaseErrorJSON } from "./releaseErrors";

// Rules versions
export { RELEASE_RULES_VERSION, PRODUCTION_CONFIG_SCHEMA_VERSION } from "./releaseRulesVersion";

// Source fingerprinting
export { computeDirectoryFingerprint } from "./sourceFingerprint";
export type { DirectoryFingerprint, FingerprintFileEntry } from "./sourceFingerprint";

// Git inspection
export { inspectGitState } from "./gitInspect";
export type { GitState } from "./gitInspect";

// Lockfile fingerprinting
export { computeLockfileHash } from "./lockfileFingerprint";

// Release identity
export { computeReleaseVersion } from "./releaseVersion";
export type { ReleaseVersionInputs } from "./releaseVersion";

// Environment schema
export { ENVIRONMENT_SCHEMA_ENTRIES, validateEnvironment, buildEnvironmentSchemaDocument, buildExampleEnvContent } from "./environmentSchema";
export type { EnvVarCategory, EnvVarType, EnvVarSchemaEntry, EnvironmentValidationError, EnvironmentValidationResult, EnvironmentSchemaDocument } from "./environmentSchema";

// Release manifest
export { buildReleaseManifest, RELEASE_SUPPORTED_TARGETS, RELEASE_CONDITIONAL_TARGETS, RELEASE_UNSUPPORTED_TARGETS } from "./manifest";
export type { ReleaseManifest, ReleaseFileEntry, ReleaseSizeSummary, ReleaseSecurityAssertions, ReleaseVerificationSummary, ReleaseRollbackCompatibilityMetadata, BuildReleaseManifestInputs } from "./manifest";

// Config
export { loadReleasePipelineConfig, describeReleasePipelineConfig } from "./releaseConfig";
export type { ReleasePipelineConfig } from "./releaseConfig";

// Bundle build/validate/inspect
export { buildReleaseBundle, listReleaseBundleOutputContents, cleanReleaseBundleOutput } from "./bundleBuilder";
export type { ReleaseBundleBuildOptions, ReleaseBundleBuildResult } from "./bundleBuilder";
export { validateReleaseBundle } from "./bundleValidator";
export type { ReleaseBundleValidationOptions, ReleaseBundleValidationResult } from "./bundleValidator";
export { getReleaseBundleStatus, inspectReleaseBundle, describeCleanTarget } from "./bundleInspect";
export type { ReleaseBundleStatus, ReleaseBundleInspection } from "./bundleInspect";

// Security
export { auditBundleSecurity } from "./security/bundleSecurityAudit";
export type { BundleSecurityFinding } from "./security/bundleSecurityAudit";

// Preflight
export { runPreflight, defaultCommandRunner } from "./preflight";
export type { CommandRunner, PreflightCheck, PreflightSection, PreflightReport, RunPreflightOptions } from "./preflight";

// Deployment dry-run
export { buildDeploymentPlan } from "./deployDryRun";
export type { DeploymentTarget, DeploymentStep, DeploymentPlan } from "./deployDryRun";

// Promotion
export { promoteRelease, getPromotionRecord } from "./promotion";
export type { PromotableState, PromotionHistoryEntry, PromotionRecord, PromoteReleaseOptions } from "./promotion";

// Rollback
export { buildRollbackManifest } from "./rollbackManifest";
export type { RollbackReleaseRef, RollbackManifest } from "./rollbackManifest";

// Smoke test definition
export { buildSmokeTestDefinition, SMOKE_TEST_CHECKS } from "./smokeTestDefinition";
export type { SmokeTestCheckDefinition, SmokeTestDefinitionDocument } from "./smokeTestDefinition";
