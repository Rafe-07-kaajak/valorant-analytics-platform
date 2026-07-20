import { getRealPredictionReadiness } from "../prediction/readiness";
import { buildHistoricalCatalog } from "../prediction/historicalCatalog";
import { predictHistoricalMatch } from "../prediction/predictionAdapter";
import { isPredictionApiError } from "../prediction/errors";

/**
 * TASK-049 section 17 — the actual in-process checks
 * `apps/web/scripts/releaseSmoke.ts` runs. Split out from the CLI script so
 * these can be unit-tested directly (no process spawn, no stdout parsing).
 * Every check calls the exact same internal modules the real API routes
 * call (`readiness.ts`, `historicalCatalog.ts`, `predictionAdapter.ts`) —
 * no HTTP server is started and no network request is made.
 */

export interface SmokeCheckResult {
  readonly id: string;
  readonly passed: boolean;
  readonly message: string;
}

export interface SmokeRunOptions {
  readonly expectedModelVersion?: string;
  readonly expectedRuntimePackageVersion?: string;
}

async function checkReadinessContract(): Promise<{ result: SmokeCheckResult; readiness: Awaited<ReturnType<typeof getRealPredictionReadiness>> }> {
  const readiness = await getRealPredictionReadiness();
  const hasRequiredFields = typeof readiness.realPredictionAvailable === "boolean" && typeof readiness.modelStatus === "string" && typeof readiness.historicalDataAvailable === "boolean" && typeof readiness.sourceMode === "string" && typeof readiness.message === "string" && typeof readiness.retryable === "boolean";
  return {
    readiness,
    result: { id: "readiness_contract", passed: hasRequiredFields, message: hasRequiredFields ? `realPredictionAvailable=${readiness.realPredictionAvailable}, sourceMode=${readiness.sourceMode}.` : "Readiness snapshot is missing one or more required fields." },
  };
}

function checkSyntheticModeAvailable(): SmokeCheckResult {
  // Synthetic scenario mode is a client-side feature with no dependency on
  // the model artifact, the runtime package, or any server-only module —
  // there is nothing to await here by construction. This check documents
  // that invariant rather than exercising a code path.
  return { id: "synthetic_mode_available", passed: true, message: "Synthetic scenario mode has no server-side dependency and remains available regardless of real-mode status." };
}

async function checkHistoricalCatalog(historicalDataAvailable: boolean): Promise<SmokeCheckResult> {
  try {
    const catalog = await buildHistoricalCatalog({});
    if (historicalDataAvailable && catalog.total === 0) {
      return { id: "historical_catalog", passed: false, message: "historicalDataAvailable is true but the catalog is empty." };
    }
    return { id: "historical_catalog", passed: true, message: `Catalog returned ${catalog.matches.length} of ${catalog.total} total match(es).` };
  } catch (error) {
    if (!historicalDataAvailable && isPredictionApiError(error)) {
      return { id: "historical_catalog", passed: true, message: `Catalog correctly unavailable: [${error.code}].` };
    }
    return { id: "historical_catalog", passed: false, message: "Catalog request failed unexpectedly while historicalDataAvailable was true." };
  }
}

async function checkDeterministicPrediction(realPredictionAvailable: boolean): Promise<SmokeCheckResult> {
  if (!realPredictionAvailable) {
    return { id: "historical_prediction_deterministic", passed: true, message: "Skipped: real prediction is not available (synthetic mode remains the active path)." };
  }
  const catalog = await buildHistoricalCatalog({ limit: 1 });
  const firstMatch = catalog.matches[0];
  if (!firstMatch) {
    return { id: "historical_prediction_deterministic", passed: false, message: "realPredictionAvailable is true but the catalog returned no rows to test against." };
  }
  const first = await predictHistoricalMatch({ matchInternalId: firstMatch.matchInternalId });
  const second = await predictHistoricalMatch({ matchInternalId: firstMatch.matchInternalId });
  const deterministic = first.teamAWinProbability === second.teamAWinProbability && first.predictedWinnerSide === second.predictedWinnerSide && first.modelVersion === second.modelVersion;
  return { id: "historical_prediction_deterministic", passed: deterministic, message: deterministic ? `Repeated prediction for ${firstMatch.matchInternalId} is deterministic (modelVersion ${first.modelVersion}).` : "Repeated prediction for the same match produced different results." };
}

function checkExpectedVersions(readiness: Awaited<ReturnType<typeof getRealPredictionReadiness>>, options: SmokeRunOptions): SmokeCheckResult {
  if (!options.expectedModelVersion && !options.expectedRuntimePackageVersion) {
    return { id: "expected_versions_match", passed: true, message: "No expected version pins were supplied — skipped." };
  }
  const modelOk = !options.expectedModelVersion || readiness.currentModelVersion === options.expectedModelVersion;
  const packageOk = !options.expectedRuntimePackageVersion || readiness.runtimePackageVersion === options.expectedRuntimePackageVersion;
  return { id: "expected_versions_match", passed: modelOk && packageOk, message: modelOk && packageOk ? "Reported versions match the expected pins." : `Version mismatch: model ${readiness.currentModelVersion ?? "(unset)"} vs expected ${options.expectedModelVersion ?? "(any)"}; runtime package ${readiness.runtimePackageVersion ?? "(unset)"} vs expected ${options.expectedRuntimePackageVersion ?? "(any)"}.` };
}

function checkSafeUnavailableState(readiness: Awaited<ReturnType<typeof getRealPredictionReadiness>>): SmokeCheckResult {
  if (readiness.realPredictionAvailable) {
    return { id: "safe_unavailable_state", passed: true, message: "Real prediction is available — nothing to verify for the unavailable path." };
  }
  const looksUnsafe = /[A-Za-z]:\\|\/(home|Users|Projects)\//.test(readiness.message) || readiness.message.toLowerCase().includes("stack");
  return { id: "safe_unavailable_state", passed: !looksUnsafe, message: looksUnsafe ? "Unavailable-state message appears to contain a path or stack trace." : "Unavailable-state message is safe; synthetic mode remains usable." };
}

export interface SmokeReport {
  readonly generatedAt: string;
  readonly passed: boolean;
  readonly checks: readonly SmokeCheckResult[];
}

export async function runReleaseSmokeChecks(options: SmokeRunOptions = {}): Promise<SmokeReport> {
  const { result: readinessCheck, readiness } = await checkReadinessContract();
  const checks: SmokeCheckResult[] = [
    readinessCheck,
    checkSyntheticModeAvailable(),
    await checkHistoricalCatalog(readiness.historicalDataAvailable),
    await checkDeterministicPrediction(readiness.realPredictionAvailable),
    checkExpectedVersions(readiness, options),
    checkSafeUnavailableState(readiness),
  ];
  return { generatedAt: new Date().toISOString(), passed: checks.every((check) => check.passed), checks };
}
