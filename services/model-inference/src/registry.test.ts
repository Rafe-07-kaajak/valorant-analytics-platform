import { describe, expect, it } from "vitest";
import { ModelRegistry } from "./registry";
import { InferenceMetrics } from "./metrics";
import { LocalFilesystemArtifactSource } from "./artifactSource";
import { loadModelInferenceConfig } from "./config";
import { buildFixtureArtifact, ELO_FIXTURE_MODEL, LOGISTIC_FIXTURE_MODEL, fixtureValidRow } from "./testFixtures/buildFixtureArtifact";
import { runInference } from "./inferenceAdapter";

function makeRegistry(artifactDir: string, overrides: Partial<ReturnType<typeof loadModelInferenceConfig>> = {}) {
  const config = { ...loadModelInferenceConfig(), artifactDir, ...overrides };
  const source = new LocalFilesystemArtifactSource(artifactDir);
  const metrics = new InferenceMetrics();
  return { registry: new ModelRegistry(source, config, metrics), metrics };
}

describe("ModelRegistry", () => {
  it("starts unloaded", async () => {
    const { artifactDir } = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL });
    const { registry } = makeRegistry(artifactDir);
    expect(registry.snapshot().status).toBe("unloaded");
    expect(registry.isReady()).toBe(false);
  });

  it("transitions to ready after a successful load, exposing model metadata", async () => {
    const { artifactDir } = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL });
    const { registry } = makeRegistry(artifactDir);
    const snapshot = await registry.load();
    expect(snapshot.status).toBe("ready");
    expect(snapshot.ready).toBe(true);
    expect(snapshot.modelVersion).toBe("fixture-model-v1");
    expect(snapshot.estimatorType).toBe("elo-baseline");
    expect(snapshot.lastSelfTest?.passed).toBe(true);
    expect(snapshot.lastSuccessfulLoadAt).not.toBeNull();
  });

  it("transitions to failed when the initial load fails and no fallback is configured", async () => {
    const { artifactDir } = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL, omitFile: "model.json" });
    const { registry } = makeRegistry(artifactDir, { fallbackPolicy: "disabled" });
    const snapshot = await registry.load();
    expect(snapshot.status).toBe("failed");
    expect(snapshot.ready).toBe(false);
    expect(snapshot.lastLoadError?.code).toBe("artifact_missing");
  });

  it("transitions to degraded (not failed) when the initial load fails but a constant fallback is configured", async () => {
    const { artifactDir } = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL, omitFile: "model.json" });
    const { registry } = makeRegistry(artifactDir, { fallbackPolicy: "constant" });
    const snapshot = await registry.load();
    expect(snapshot.status).toBe("degraded");
    expect(registry.isFallbackActive()).toBe(true);
  });

  it("a successful reload replaces the loaded model version", async () => {
    const { artifactDir, rootDir } = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL, manifestOverrides: { modelVersion: "v1" } });
    const { registry } = makeRegistry(artifactDir);
    await registry.load();
    expect(registry.snapshot().modelVersion).toBe("v1");

    await buildFixtureArtifactInPlace(rootDir, { model: LOGISTIC_FIXTURE_MODEL, manifestOverrides: { modelVersion: "v2" } });
    const reloadSnapshot = await registry.reload();
    expect(reloadSnapshot.modelVersion).toBe("v2");
    expect(reloadSnapshot.estimatorType).toBe("logistic-regression");
  });

  it("a failed reload preserves the previously healthy model rather than downgrading the registry", async () => {
    const { artifactDir } = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL, manifestOverrides: { modelVersion: "v1" } });
    const { registry, metrics } = makeRegistry(artifactDir);
    await registry.load();
    expect(registry.snapshot().status).toBe("ready");

    // Corrupt the on-disk artifact in place, then reload — the corrupted candidate must never replace the healthy v1 model.
    const { unlink } = await import("node:fs/promises");
    const { join } = await import("node:path");
    await unlink(join(artifactDir, "model.json"));

    const reloadSnapshot = await registry.reload();
    expect(reloadSnapshot.status).toBe("ready");
    expect(reloadSnapshot.modelVersion).toBe("v1");
    expect(reloadSnapshot.lastLoadError?.code).toBe("artifact_missing");
    expect(metrics.snapshot().reloadFailureCount).toBe(1);
  });

  it("a same-version reload succeeds and re-runs self-test", async () => {
    const { artifactDir } = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL, manifestOverrides: { modelVersion: "v1" } });
    const { registry } = makeRegistry(artifactDir);
    await registry.load();
    const reloadSnapshot = await registry.reload();
    expect(reloadSnapshot.modelVersion).toBe("v1");
    expect(reloadSnapshot.status).toBe("ready");
  });

  it("concurrent inference during a reload always uses a consistent, fully-loaded model snapshot", async () => {
    const { artifactDir, rootDir } = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL, manifestOverrides: { modelVersion: "v1" } });
    const { registry } = makeRegistry(artifactDir);
    await registry.load();

    await buildFixtureArtifactInPlace(rootDir, { model: LOGISTIC_FIXTURE_MODEL, manifestOverrides: { modelVersion: "v2" } });

    const reloadPromise = registry.reload();
    // A prediction issued "during" the reload synchronously reads whatever
    // artifact reference is currently assigned (either v1 or the newly
    // swapped-in v2, never a partially-constructed candidate) — both are
    // individually valid, fully-self-tested artifacts.
    const artifactDuringReload = registry.getCurrentArtifact();
    expect(artifactDuringReload).not.toBeNull();
    const result = runInference(artifactDuringReload!, fixtureValidRow());
    expect(Number.isFinite(result.teamAWinProbability)).toBe(true);

    await reloadPromise;
    expect(registry.snapshot().modelVersion).toBe("v2");
  });
});

async function buildFixtureArtifactInPlace(rootDir: string, options: Parameters<typeof buildFixtureArtifact>[0]): Promise<void> {
  // Builds a fresh fixture elsewhere, then copies its files over the
  // registry's already-configured `artifactDir` (inside `rootDir`) — mirrors
  // a real `pnpm ingest:vlr:model:train` re-run overwriting the same local
  // artifact directory in place.
  const { MODEL_DIR_SEGMENTS } = await import("@repo/vlr-ingestion");
  const { join } = await import("node:path");
  const fs = await import("node:fs/promises");
  const built = await buildFixtureArtifact(options);
  const targetDir = join(rootDir, ...MODEL_DIR_SEGMENTS);
  await fs.mkdir(targetDir, { recursive: true });
  for (const fileName of await fs.readdir(built.artifactDir)) {
    const content = await fs.readFile(join(built.artifactDir, fileName), "utf-8");
    await fs.writeFile(join(targetDir, fileName), content, "utf-8");
  }
}
