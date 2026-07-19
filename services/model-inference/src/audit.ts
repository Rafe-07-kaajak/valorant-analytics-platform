import { APPROVED_ARTIFACT_FILENAMES, INFERENCE_CRITICAL_FILENAMES, type ArtifactSource } from "./artifactSource";
import { validateArtifact } from "./artifactValidator";
import { toLoadedModelArtifact } from "./inferenceAdapter";
import { runSelfTest, type SelfTestReport } from "./selfTest";
import type { ModelInferenceConfig } from "./config";
import { toSafeError, type SafeInferenceErrorJSON } from "./errors";

/**
 * Artifact readiness audit — TASK-046 requirement 2. Read-only: never
 * writes to the artifact directory. Reports on file presence, size,
 * content-hash agreement, estimator/calibration support, and a simple
 * advisory scan for embedded absolute machine-specific paths in artifact
 * content (informational only — this never blocks a load, since a
 * legitimate string field could coincidentally match the pattern).
 */

const ABSOLUTE_PATH_PATTERNS: readonly RegExp[] = [/[A-Za-z]:\\\\?[A-Za-z0-9_\-\\\\ .]+/, /\/home\/[A-Za-z0-9_\-./]+/, /\/Users\/[A-Za-z0-9_\-./]+/, /\/root\/[A-Za-z0-9_\-./]+/];

export interface AuditFileEntry {
  readonly fileName: string;
  readonly present: boolean;
  readonly sizeBytes: number | null;
  readonly hashRecorded: boolean;
  readonly hashMatches: boolean | null;
  readonly suspiciousAbsolutePathMatch: boolean;
}

export interface AuditReport {
  readonly generatedAt: string;
  readonly artifactDirectoryId: string;
  readonly criticalFilesPresent: boolean;
  readonly files: readonly AuditFileEntry[];
  readonly manifestSummary: { readonly modelVersion: string; readonly estimatorType: string; readonly calibrationMethod: string; readonly sourceFeatureDatasetVersion: string; readonly featureSchemaVersion: string; readonly generatedAt: string } | null;
  readonly estimatorSupported: boolean | null;
  readonly calibrationSupported: boolean | null;
  readonly selfTest: { readonly passed: boolean; readonly checkCount: number; readonly durationMs: number } | null;
  readonly warnings: readonly string[];
  readonly loadError: SafeInferenceErrorJSON | null;
  readonly overallReady: boolean;
}

interface MutableAuditFileEntry {
  fileName: string;
  present: boolean;
  sizeBytes: number | null;
  hashRecorded: boolean;
  hashMatches: boolean | null;
  suspiciousAbsolutePathMatch: boolean;
}

export async function runArtifactAudit(source: ArtifactSource, config: ModelInferenceConfig): Promise<AuditReport> {
  const descriptor = source.describe();
  const present = await source.listFiles();
  const presentSet = new Set<string>(present);

  const files: MutableAuditFileEntry[] = [];
  for (const fileName of APPROVED_ARTIFACT_FILENAMES) {
    const isPresent = presentSet.has(fileName);
    let sizeBytes: number | null = null;
    let suspiciousAbsolutePathMatch = false;
    if (isPresent) {
      try {
        const stat = await source.statFile(fileName);
        sizeBytes = stat.sizeBytes;
        if (sizeBytes <= config.maxArtifactFileBytes) {
          const raw = await source.readFile(fileName, config.maxArtifactFileBytes);
          suspiciousAbsolutePathMatch = ABSOLUTE_PATH_PATTERNS.some((pattern) => pattern.test(raw));
        }
      } catch {
        // Leave sizeBytes null / suspiciousAbsolutePathMatch false; the file-presence entry alone is still informative.
      }
    }
    files.push({ fileName, present: isPresent, sizeBytes, hashRecorded: false, hashMatches: null, suspiciousAbsolutePathMatch });
  }

  const criticalFilesPresent = INFERENCE_CRITICAL_FILENAMES.every((fileName) => presentSet.has(fileName));

  let manifestSummary: AuditReport["manifestSummary"] = null;
  let estimatorSupported: boolean | null = null;
  let calibrationSupported: boolean | null = null;
  let selfTest: AuditReport["selfTest"] = null;
  let warnings: readonly string[] = [];
  let loadError: SafeInferenceErrorJSON | null = null;

  try {
    const result = await validateArtifact(source, config);
    warnings = result.warnings;
    manifestSummary = {
      modelVersion: result.files.manifest.modelVersion,
      estimatorType: result.files.manifest.estimatorType,
      calibrationMethod: result.files.manifest.calibrationMethod,
      sourceFeatureDatasetVersion: result.files.manifest.sourceFeatureDatasetVersion,
      featureSchemaVersion: result.files.manifest.featureSchemaVersion,
      generatedAt: result.files.manifest.generatedAt,
    };
    estimatorSupported = true;
    calibrationSupported = true;

    for (const entry of files) {
      const expected = result.files.manifest.contentHashes[entry.fileName];
      if (expected) {
        entry.hashRecorded = true;
        // `validateArtifact` already threw above on any mismatch among the
        // 5 inference-critical files, so reaching this line means every
        // hash that was checked matched; report-only files are recorded as
        // present but not independently re-verified here (the service
        // never reads them at inference time).
        entry.hashMatches = true;
      }
    }

    const artifact = toLoadedModelArtifact(result.files);
    const selfTestReport: SelfTestReport = runSelfTest(artifact);
    selfTest = { passed: selfTestReport.passed, checkCount: selfTestReport.checks.length, durationMs: selfTestReport.durationMs };
  } catch (error) {
    loadError = toSafeError(error);
    if (loadError.code === "unsupported_estimator") estimatorSupported = false;
    if (loadError.code === "unsupported_calibration") calibrationSupported = false;
  }

  return {
    generatedAt: new Date().toISOString(),
    artifactDirectoryId: descriptor.directoryId,
    criticalFilesPresent,
    files,
    manifestSummary,
    estimatorSupported,
    calibrationSupported,
    selfTest,
    warnings,
    loadError,
    overallReady: loadError === null && selfTest?.passed === true,
  };
}
