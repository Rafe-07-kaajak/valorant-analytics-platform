/**
 * Provider-neutral description of what `pnpm release:smoke:local`
 * (`apps/web/scripts/releaseSmoke.ts`) checks — written into a release
 * bundle's `operations/smoke-test-definition.json` so an operator can see
 * the verification plan without reading source. This module only describes
 * the plan; `apps/web`'s own script performs it in-process.
 */

export interface SmokeTestCheckDefinition {
  readonly id: string;
  readonly description: string;
}

export const SMOKE_TEST_CHECKS: readonly SmokeTestCheckDefinition[] = [
  { id: "readiness_contract", description: "GET-equivalent readiness snapshot exposes realPredictionAvailable, modelStatus, historicalDataAvailable, sourceMode, safe message/retryable — never a path, hash, or stack trace." },
  { id: "synthetic_mode_available", description: "Synthetic scenario mode is usable independent of model/runtime-package state (structural check, no server dependency)." },
  { id: "historical_catalog", description: "Historical catalog listing succeeds and is non-empty when historicalDataAvailable is true." },
  { id: "historical_prediction_deterministic", description: "One historical prediction request repeated twice for the same matchInternalId returns byte-identical teamAWinProbability/predictedWinnerSide/modelVersion." },
  { id: "expected_versions_match", description: "When --expect-model-version / --expect-runtime-package-version are supplied, the readiness snapshot's reported versions match exactly." },
  { id: "safe_unavailable_state", description: "When the runtime package is missing/invalid, readiness reports a safe unavailable state (no raw error, no path) and synthetic mode remains usable." },
];

export interface SmokeTestDefinitionDocument {
  readonly command: string;
  readonly executionModel: string;
  readonly networkPolicy: string;
  readonly checks: readonly SmokeTestCheckDefinition[];
}

export function buildSmokeTestDefinition(): SmokeTestDefinitionDocument {
  return {
    command: "pnpm release:smoke:local",
    executionModel: "In-process: imports apps/web's own readiness/historicalCatalog/predictionAdapter modules directly — no HTTP server is started, no network request is made.",
    networkPolicy: "No external network access. Reads only the locally configured runtime package / local-generated data.",
    checks: SMOKE_TEST_CHECKS,
  };
}
