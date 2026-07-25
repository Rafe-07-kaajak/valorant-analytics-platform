import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, renameSync } from "node:fs";
import { resolve } from "node:path";

/**
 * `pnpm verify:vercel-parity` (this package) — TASK-048 deployment-fix
 * round 2. Reproduces the exact condition a fresh Vercel checkout runs
 * under (no gitignored `.local` datasets, only the git-committed
 * `apps/web/server-data/vlr-data` snapshot, served from the *built* `.next`
 * output) and asserts the four real-prediction routes behave as they must
 * in production: readiness reports `realPredictionAvailable: true`,
 * current-match prediction succeeds, the historical catalog loads, and a
 * historical prediction succeeds.
 *
 * Deliberately NOT part of `pnpm test` — it renames real local directories
 * (restored in a `finally`, but a hard kill mid-run would leave them
 * renamed) and runs a full `next build`, both too slow/invasive for a
 * routine test run. Run this specifically when verifying that a change to
 * `defaultFeatureDataDir()`/`defaultArtifactDir()`/`outputFileTracingIncludes`
 * still holds under production-like conditions — see docs/36, "Vercel
 * deployment."
 */

const REPO_ROOT = resolve(__dirname, "../../..");
const APP_DIR = resolve(REPO_ROOT, "apps", "web");
const VLR_LOCAL = resolve(REPO_ROOT, "services", "vlr-ingestion", ".local");
const MODEL_LOCAL = resolve(REPO_ROOT, "services", "model-inference", ".local");
const VLR_BACKUP = `${VLR_LOCAL}.vercel-parity-backup`;
const MODEL_BACKUP = `${MODEL_LOCAL}.vercel-parity-backup`;
const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

function log(message: string): void {
  console.log(`[verify:vercel-parity] ${message}`);
}

function fail(message: string): never {
  throw new Error(message);
}

/** Fails loud instead of silently overwriting if a previous interrupted run left a stale backup. */
function assertNoStaleBackup(): void {
  if (existsSync(VLR_BACKUP) || existsSync(MODEL_BACKUP)) {
    fail(`A previous run's backup directory still exists (${VLR_BACKUP} and/or ${MODEL_BACKUP}). Resolve manually before re-running: restore it to its original ".local" location, or remove it if it is known-stale.`);
  }
}

function hideLocalDirectories(): void {
  if (existsSync(VLR_LOCAL)) renameSync(VLR_LOCAL, VLR_BACKUP);
  if (existsSync(MODEL_LOCAL)) renameSync(MODEL_LOCAL, MODEL_BACKUP);
}

function restoreLocalDirectories(): void {
  if (existsSync(VLR_BACKUP)) renameSync(VLR_BACKUP, VLR_LOCAL);
  if (existsSync(MODEL_BACKUP)) renameSync(MODEL_BACKUP, MODEL_LOCAL);
}

function runToCompletion(command: string, args: readonly string[]): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: APP_DIR, stdio: "inherit", shell: true });
    child.on("exit", (code) => (code === 0 ? resolvePromise() : reject(new Error(`"${command} ${args.join(" ")}" exited with code ${code}`))));
    child.on("error", reject);
  });
}

function startServer(): ChildProcess {
  return spawn("pnpm", ["exec", "next", "start", "-p", String(PORT)], { cwd: APP_DIR, stdio: "inherit", shell: true });
}

async function waitForServer(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/api/internal/prediction/readiness`);
      if (response.ok || response.status === 503) return;
    } catch {
      // Server not accepting connections yet.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  fail(`Server did not become ready within ${timeoutMs}ms.`);
}

async function checkReadiness(): Promise<void> {
  const response = await fetch(`${BASE_URL}/api/internal/prediction/readiness`);
  const body = await response.json();
  if (body.realPredictionAvailable !== true) {
    fail(`readiness.realPredictionAvailable was not true with .local absent: ${JSON.stringify(body)}`);
  }
  log(`readiness OK (modelStatus=${body.modelStatus}, sourceMode=${body.sourceMode}).`);
}

async function checkCatalogAndHistorical(): Promise<void> {
  const catalogResponse = await fetch(`${BASE_URL}/api/internal/prediction/catalog?limit=1`);
  if (!catalogResponse.ok) fail(`Catalog request failed: HTTP ${catalogResponse.status}`);
  const catalog = await catalogResponse.json();
  const firstMatch = catalog.matches?.[0];
  if (!firstMatch) fail(`Catalog returned no matches: ${JSON.stringify(catalog)}`);
  log(`catalog OK (${catalog.total} total matches).`);

  const historicalResponse = await fetch(`${BASE_URL}/api/internal/prediction/historical`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "historical-real-model", matchInternalId: firstMatch.matchInternalId }),
  });
  if (!historicalResponse.ok) fail(`Historical prediction request failed: HTTP ${historicalResponse.status} — ${await historicalResponse.text()}`);
  const historical = await historicalResponse.json();
  if (typeof historical.teamAWinProbability !== "number") fail(`Historical prediction response missing teamAWinProbability: ${JSON.stringify(historical)}`);
  log(`historical prediction OK (matchInternalId=${firstMatch.matchInternalId}, modelVersion=${historical.modelVersion}).`);
}

async function checkCurrentPrediction(): Promise<void> {
  const response = await fetch(`${BASE_URL}/api/internal/prediction/current`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "current-real-model", teamAId: "g2-esports", teamBId: "fnatic", seriesFormat: "BO3", tournamentTier: "international" }),
  });
  if (!response.ok) fail(`Current-match prediction request failed: HTTP ${response.status} — ${await response.text()}`);
  const result = await response.json();
  if (typeof result.teamAWinProbability !== "number") fail(`Current-match prediction response missing teamAWinProbability: ${JSON.stringify(result)}`);
  log(`current-match prediction OK (teamAWinProbability=${result.teamAWinProbability}).`);
}

async function main(): Promise<void> {
  assertNoStaleBackup();

  let server: ChildProcess | undefined;
  try {
    hideLocalDirectories();
    log("Both .local directories hidden — simulating a fresh Vercel checkout.");

    log("Building (pnpm build)...");
    await runToCompletion("pnpm", ["build"]);

    log(`Starting built server on port ${PORT}...`);
    server = startServer();
    await waitForServer(60_000);

    await checkReadiness();
    await checkCurrentPrediction();
    await checkCatalogAndHistorical();

    log("PASSED — all four routes behave correctly with .local absent, served from the built .next output.");
  } finally {
    if (server) {
      server.kill();
    }
    restoreLocalDirectories();
    log("Both .local directories restored.");
  }
}

main().catch((error) => {
  console.error(`[verify:vercel-parity] FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
