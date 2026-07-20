/**
 * Rollback-safety manifest — TASK-049 section 15. Never executes a
 * rollback (no destructive command exists anywhere in this module); it
 * only reports whether rolling back *would* be safe and what an operator
 * would need to check/change by hand. Explicitly distinguishes three
 * different "rollback" concepts that are easy to conflate: rolling back
 * the application code, rolling back the runtime package (model + replay
 * data), and disabling real-mode entirely in favor of the synthetic
 * scenario builder (the emergency fallback that has no data dependency at
 * all).
 */

export interface RollbackReleaseRef {
  readonly releaseVersion: string;
  readonly runtimePackageVersion: string;
  readonly modelVersion: string;
  readonly sourceFeatureDatasetVersion: string;
  readonly featureSchemaVersion: string;
  readonly featureRulesVersion: string;
}

export interface RollbackManifest {
  readonly currentReleaseVersion: string;
  readonly runtimePackageVersion: string;
  readonly modelVersion: string;
  readonly sourceFeatureDatasetVersion: string;
  readonly previousReleaseVersion?: string;
  readonly previousRuntimePackageVersion?: string;
  readonly rollbackCompatible: boolean;
  readonly rollbackBlockers: readonly string[];
  readonly requiredEnvironmentChanges: readonly string[];
  readonly requiredMountPath: string;
  readonly dataCompatibilityNotes: string;
  readonly applicationCompatibilityNotes: string;
  readonly rollbackVerificationChecklist: readonly string[];
  readonly syntheticModeEmergencyFallbackPolicy: string;
  readonly rollbackKinds: {
    readonly applicationRollback: string;
    readonly runtimePackageRollback: string;
    readonly realModeDisablement: string;
  };
}

const SYNTHETIC_MODE_FALLBACK_POLICY =
  "Synthetic scenario mode has no dependency on the model artifact or the historical runtime package — it remains fully usable even when the runtime package is missing, invalid, or from an incompatible release. It is the recommended immediate mitigation during any real-prediction incident, ahead of a code or data rollback.";

export function buildRollbackManifest(current: RollbackReleaseRef, previous?: RollbackReleaseRef): RollbackManifest {
  const rollbackBlockers: string[] = [];

  if (!previous) {
    rollbackBlockers.push("No previous release is recorded — there is nothing to roll back to yet.");
  } else {
    if (previous.featureSchemaVersion !== current.featureSchemaVersion || previous.featureRulesVersion !== current.featureRulesVersion) {
      rollbackBlockers.push(`Feature schema/rules version differs between the current release (${previous.featureSchemaVersion !== current.featureSchemaVersion ? `schema ${current.featureSchemaVersion} vs previous ${previous.featureSchemaVersion}` : `rules ${current.featureRulesVersion} vs previous ${previous.featureRulesVersion}`}) — rolling back the application without also rolling back the runtime package risks a feature-contract mismatch at request time.`);
    }
  }

  const rollbackCompatible = previous === undefined ? true : rollbackBlockers.length === 0;

  return {
    currentReleaseVersion: current.releaseVersion,
    runtimePackageVersion: current.runtimePackageVersion,
    modelVersion: current.modelVersion,
    sourceFeatureDatasetVersion: current.sourceFeatureDatasetVersion,
    ...(previous ? { previousReleaseVersion: previous.releaseVersion, previousRuntimePackageVersion: previous.runtimePackageVersion } : {}),
    rollbackCompatible,
    rollbackBlockers,
    requiredEnvironmentChanges: previous && previous.runtimePackageVersion !== current.runtimePackageVersion ? [`REAL_PREDICTION_EXPECTED_RUNTIME_PACKAGE_VERSION should be repointed to "${previous.runtimePackageVersion}" if the runtime package itself is also being rolled back.`] : [],
    requiredMountPath: "The runtime package mount path (REAL_PREDICTION_RUNTIME_PACKAGE_DIR) is unchanged by an application rollback — only the application code/version at that path changes.",
    dataCompatibilityNotes: "There is no database in this stack — the runtime package is the only versioned data artifact. A data rollback means re-mounting a previously built runtime package directory, never a destructive data operation.",
    applicationCompatibilityNotes: previous ? `Application rollback target: release ${previous.releaseVersion} (applicationBuildFingerprint recorded in that release's own manifest).` : "No previous application release is recorded.",
    rollbackVerificationChecklist: ["Confirm the target release's release-manifest.json hashes still validate (`pnpm release:bundle:validate`).", "Confirm REAL_PREDICTION_EXPECTED_RUNTIME_PACKAGE_VERSION (if pinned) matches the runtime package actually mounted.", "Run `pnpm release:smoke:local` against the rolled-back environment.", "Confirm the readiness endpoint reports the expected modelVersion/runtimePackageVersion.", "If any check fails, disable real mode (REAL_PREDICTION_ENABLED=false) and rely on synthetic mode while investigating."],
    syntheticModeEmergencyFallbackPolicy: SYNTHETIC_MODE_FALLBACK_POLICY,
    rollbackKinds: {
      applicationRollback: "Redeploying a previous release's application code (pinned by sourceCommitSha/applicationBuildFingerprint) while the runtime package mount is left as-is or explicitly repointed.",
      runtimePackageRollback: "Re-mounting a previously built runtime-package directory (a different modelVersion/sourceFeatureDatasetVersion) while the application code is left as-is.",
      realModeDisablement: "Setting REAL_PREDICTION_ENABLED=false (or leaving REAL_PREDICTION_REQUIRE_RUNTIME_PACKAGE=false with no package mounted) so only synthetic scenario mode is served — no code or data rollback required, fastest mitigation.",
    },
  };
}
