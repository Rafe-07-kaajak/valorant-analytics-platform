import { spawn } from "node:child_process";
import { lstat } from "node:fs/promises";
import { isRuntimePackageError, loadRuntimePackage } from "@repo/model-inference";
import { resolveSafePath } from "@repo/vlr-ingestion";
import { inspectGitState } from "./gitInspect";
import { validateEnvironment } from "./environmentSchema";
import type { ReleasePipelineConfig } from "./releaseConfig";

/**
 * Production preflight validator — TASK-049 section 9 (`pnpm
 * release:preflight`). Orchestrates existing, already-trusted checks
 * (`pnpm lint`/`check-types`/`test`/`build`, `@repo/model-inference`'s own
 * runtime-package loader) rather than reimplementing them — this module's
 * only new logic is the source/configuration checks and report assembly.
 * The expensive application checks (full monorepo lint/typecheck/test/
 * build) are injectable via `commandRunner` so unit tests can stub them
 * and stay fast; the real CLI entrypoint uses the real spawn-based runner.
 */

export interface CommandRunner {
  (command: string, args: readonly string[], cwd: string): Promise<{ readonly exitCode: number }>;
}

export const defaultCommandRunner: CommandRunner = (command, args, cwd) =>
  new Promise((resolvePromise) => {
    // `shell: true` is required for `pnpm` to resolve on Windows (a .cmd
    // shim); safe here because `command`/`args` are always fixed literals
    // from this module, never user- or environment-supplied strings.
    const child = spawn(command, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
    child.on("close", (code) => resolvePromise({ exitCode: code ?? 1 }));
    child.on("error", () => resolvePromise({ exitCode: 1 }));
  });

export interface PreflightCheck {
  readonly id: string;
  readonly passed: boolean;
  readonly message: string;
}

export interface PreflightSection {
  readonly name: "source" | "application" | "runtimePackage" | "configuration";
  readonly passed: boolean;
  readonly checks: readonly PreflightCheck[];
}

export interface PreflightReport {
  readonly generatedAt: string;
  readonly passed: boolean;
  readonly sections: readonly PreflightSection[];
  readonly lintPassed?: boolean;
  readonly typecheckPassed?: boolean;
  readonly testsPassed?: boolean;
  readonly buildPassed?: boolean;
  readonly durationMs: number;
}

export interface RunPreflightOptions {
  readonly config: ReleasePipelineConfig;
  /** Skips the expensive `pnpm lint`/`check-types`/`test`/`build` spawn sequence — used by CI's fixture job and by unit tests, never by a real pre-release run. */
  readonly skipApplicationChecks?: boolean;
  readonly commandRunner?: CommandRunner;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly strictProductionConfig?: boolean;
}

async function runSourceSection(config: ReleasePipelineConfig): Promise<PreflightSection> {
  const gitState = inspectGitState(config.repoRootDir);
  const checks: PreflightCheck[] = [];

  // Informational only — `sourceCommitSha` is documented as "when available"
  // throughout the release manifest/identity contract, so a release built
  // outside a Git checkout (e.g. from a source archive) can still pass
  // preflight, just with reduced provenance.
  checks.push({ id: "commit_sha_available", passed: true, message: gitState.commitSha ? `HEAD is ${gitState.commitSha.slice(0, 12)}.` : "Could not resolve the current commit SHA (not a Git checkout, or Git is unavailable) — release identity will omit sourceCommitSha." });

  const dirtyPassed = !config.requireCleanTree || !gitState.isDirty;
  checks.push({ id: "clean_tree", passed: dirtyPassed, message: gitState.isDirty ? `Working tree has ${gitState.dirtyFiles.length} uncommitted change(s)${config.requireCleanTree ? " (RELEASE_REQUIRE_CLEAN_TREE=true)" : " (informational only)"}.` : "Working tree is clean." });

  const lockfileStat = await lstat(resolveSafePath(config.repoRootDir, "pnpm-lock.yaml")).catch(() => null);
  checks.push({ id: "lockfile_present", passed: lockfileStat !== null, message: lockfileStat ? "pnpm-lock.yaml is present." : "pnpm-lock.yaml was not found at the repository root." });

  return { name: "source", passed: checks.every((check) => check.passed), checks };
}

async function runApplicationSection(config: ReleasePipelineConfig, runner: CommandRunner): Promise<{ section: PreflightSection; lintPassed: boolean; typecheckPassed: boolean; testsPassed: boolean; buildPassed: boolean }> {
  const steps: readonly { readonly id: string; readonly args: readonly string[] }[] = [
    { id: "lint", args: ["lint"] },
    { id: "check-types", args: ["check-types"] },
    { id: "test", args: ["test"] },
    { id: "build", args: ["build"] },
  ];
  const checks: PreflightCheck[] = [];
  const results: Record<string, boolean> = {};
  for (const step of steps) {
    const { exitCode } = await runner("pnpm", step.args, config.repoRootDir);
    const passed = exitCode === 0;
    results[step.id] = passed;
    checks.push({ id: step.id, passed, message: passed ? `pnpm ${step.args.join(" ")} succeeded.` : `pnpm ${step.args.join(" ")} failed (exit code ${exitCode}).` });
  }
  return { section: { name: "application", passed: checks.every((check) => check.passed), checks }, lintPassed: results.lint, typecheckPassed: results["check-types"], testsPassed: results.test, buildPassed: results.build };
}

async function runRuntimePackageSection(config: ReleasePipelineConfig): Promise<PreflightSection> {
  const checks: PreflightCheck[] = [];
  try {
    const loaded = await loadRuntimePackage(config.runtimePackageDir, { expectedVersion: config.expectedRuntimePackageVersion, maxFileBytes: config.maxFileBytes });
    checks.push({ id: "runtime_package_valid", passed: true, message: `Runtime package "${loaded.manifest.runtimePackageVersion}" validated (model ${loaded.manifest.modelVersion}, ${loaded.manifest.historical.rowCount} historical rows).` });
  } catch (error) {
    checks.push({ id: "runtime_package_valid", passed: false, message: isRuntimePackageError(error) ? `Runtime package validation failed: [${error.code}] ${error.message}` : "Runtime package validation failed with an unexpected error." });
  }
  return { name: "runtimePackage", passed: checks.every((check) => check.passed), checks };
}

function runConfigurationSection(env: Readonly<Record<string, string | undefined>>, strictProduction: boolean): PreflightSection {
  const result = validateEnvironment(env, { strictProduction });
  const checks: PreflightCheck[] = result.valid
    ? [{ id: "environment_valid", passed: true, message: `Environment configuration is valid${strictProduction ? " under strict production rules" : ""}.` }]
    : result.errors.map((error) => ({ id: `environment_${error.name}`, passed: false, message: `${error.name} ${error.reason}` }));
  return { name: "configuration", passed: checks.every((check) => check.passed), checks };
}

export async function runPreflight(options: RunPreflightOptions): Promise<PreflightReport> {
  const startedAt = Date.now();
  const runner = options.commandRunner ?? defaultCommandRunner;

  const sourceSection = await runSourceSection(options.config);

  let applicationSection: PreflightSection;
  let lintPassed: boolean | undefined;
  let typecheckPassed: boolean | undefined;
  let testsPassed: boolean | undefined;
  let buildPassed: boolean | undefined;
  if (options.skipApplicationChecks) {
    applicationSection = { name: "application", passed: true, checks: [{ id: "skipped", passed: true, message: "Application checks skipped (fixture/unit-test mode)." }] };
  } else {
    const result = await runApplicationSection(options.config, runner);
    applicationSection = result.section;
    lintPassed = result.lintPassed;
    typecheckPassed = result.typecheckPassed;
    testsPassed = result.testsPassed;
    buildPassed = result.buildPassed;
  }

  const runtimePackageSection = await runRuntimePackageSection(options.config);
  const configurationSection = runConfigurationSection(options.env ?? process.env, options.strictProductionConfig ?? false);

  const sections = [sourceSection, applicationSection, runtimePackageSection, configurationSection];

  return {
    generatedAt: new Date().toISOString(),
    passed: sections.every((section) => section.passed),
    sections,
    lintPassed,
    typecheckPassed,
    testsPassed,
    buildPassed,
    durationMs: Date.now() - startedAt,
  };
}
