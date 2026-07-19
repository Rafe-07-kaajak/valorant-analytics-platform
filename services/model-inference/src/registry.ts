import type { LoadedModelArtifact } from "@repo/vlr-ingestion";
import type { ArtifactSource } from "./artifactSource";
import { validateArtifact } from "./artifactValidator";
import { toLoadedModelArtifact } from "./inferenceAdapter";
import { runSelfTest, type SelfTestReport } from "./selfTest";
import type { ModelInferenceConfig } from "./config";
import { InferenceMetrics } from "./metrics";
import { toSafeError, type SafeInferenceErrorJSON } from "./errors";

/**
 * In-process model registry — TASK-046 requirement 6. A failed load or
 * reload never replaces a previously healthy model: the new candidate is
 * fully validated and self-tested *before* the registry's current-model
 * reference is reassigned, and the reassignment itself is a single
 * synchronous property write (JavaScript's single-threaded execution model
 * makes this atomic with respect to any concurrently in-flight `predict()`
 * call, which already holds its own reference to the artifact it started
 * with).
 */

export type RegistryStatus = "unloaded" | "loading" | "ready" | "degraded" | "failed";

export interface RegistrySnapshot {
  readonly status: RegistryStatus;
  readonly ready: boolean;
  readonly modelVersion: string | null;
  readonly estimatorType: string | null;
  readonly calibrationMethod: string | null;
  readonly sourceFeatureDatasetVersion: string | null;
  readonly featureSchemaVersion: string | null;
  readonly featureRulesVersion: string | null;
  readonly loadedAt: string | null;
  readonly artifactDirectoryId: string;
  readonly lastLoadError: SafeInferenceErrorJSON | null;
  readonly lastSuccessfulLoadAt: string | null;
  readonly lastSelfTest: { readonly passed: boolean; readonly checkCount: number; readonly durationMs: number } | null;
  readonly fallbackActive: boolean;
}

interface CurrentModel {
  readonly artifact: LoadedModelArtifact;
  readonly loadedAt: string;
  readonly artifactWarnings: readonly string[];
  readonly selfTest: SelfTestReport;
}

export class ModelRegistry {
  private status: RegistryStatus = "unloaded";
  private current: CurrentModel | null = null;
  private lastLoadError: SafeInferenceErrorJSON | null = null;
  private lastSuccessfulLoadAt: string | null = null;

  constructor(
    private readonly source: ArtifactSource,
    private readonly config: ModelInferenceConfig,
    private readonly metrics: InferenceMetrics,
    private readonly now: () => Date = () => new Date(),
  ) {}

  getCurrentArtifact(): LoadedModelArtifact | null {
    return this.current?.artifact ?? null;
  }

  isReady(): boolean {
    return this.status === "ready" && this.current !== null;
  }

  isFallbackActive(): boolean {
    return this.status === "degraded";
  }

  private async attemptLoadAndApply(isReload: boolean): Promise<RegistrySnapshot> {
    if (this.current === null) this.status = "loading";
    try {
      const validated = await validateArtifact(this.source, this.config);
      const artifact = toLoadedModelArtifact(validated.files);
      const selfTest = runSelfTest(artifact);

      // Atomic swap: only reachable after full validation + self-test succeed.
      this.current = { artifact, loadedAt: this.now().toISOString(), artifactWarnings: validated.warnings, selfTest };
      this.status = "ready";
      this.lastLoadError = null;
      this.lastSuccessfulLoadAt = this.current.loadedAt;
      if (isReload) this.metrics.recordReloadSuccess();
    } catch (error) {
      const safe = toSafeError(error);
      this.lastLoadError = safe;
      if (this.current === null) {
        this.status = this.config.fallbackPolicy === "constant" ? "degraded" : "failed";
      }
      // else: a previously healthy model stays `ready` untouched — a failed
      // reload never downgrades a working registry.
      if (isReload) this.metrics.recordReloadFailure(safe.code);
    }
    return this.snapshot();
  }

  /** Startup load. Safe to call more than once (e.g. a retry); never throws — callers that need fail-fast behavior should inspect the returned snapshot's `status`. */
  async load(): Promise<RegistrySnapshot> {
    return this.attemptLoadAndApply(false);
  }

  /** Manual reload — TASK-046 requirement 16. Builds and self-tests a full candidate before ever touching the live registry state. */
  async reload(): Promise<RegistrySnapshot> {
    return this.attemptLoadAndApply(true);
  }

  snapshot(): RegistrySnapshot {
    return {
      status: this.status,
      ready: this.isReady(),
      modelVersion: this.current?.artifact.manifest.modelVersion ?? null,
      estimatorType: this.current?.artifact.manifest.estimatorType ?? null,
      calibrationMethod: this.current?.artifact.manifest.calibrationMethod ?? null,
      sourceFeatureDatasetVersion: this.current?.artifact.manifest.sourceFeatureDatasetVersion ?? null,
      featureSchemaVersion: this.current?.artifact.featureContract.featureSchemaVersion ?? null,
      featureRulesVersion: this.current?.artifact.featureContract.featureRulesVersion ?? null,
      loadedAt: this.current?.loadedAt ?? null,
      artifactDirectoryId: this.source.describe().directoryId,
      lastLoadError: this.lastLoadError,
      lastSuccessfulLoadAt: this.lastSuccessfulLoadAt,
      lastSelfTest: this.current ? { passed: this.current.selfTest.passed, checkCount: this.current.selfTest.checks.length, durationMs: this.current.selfTest.durationMs } : null,
      fallbackActive: this.isFallbackActive(),
    };
  }
}
