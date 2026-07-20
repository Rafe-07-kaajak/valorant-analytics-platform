import { PRODUCTION_CONFIG_SCHEMA_VERSION } from "./releaseRulesVersion";

/**
 * Typed production configuration schema — TASK-049 section 8. Documents
 * (never re-implements) the environment variables already read by
 * `apps/web/src/server/prediction/config.ts` and
 * `services/model-inference/src/config.ts`; this module is the single
 * source of truth for what a "strict production" environment must satisfy,
 * used by `preflight.ts` (validates the live `process.env`) and
 * `bundleBuilder.ts` (writes `config/environment-schema.json` +
 * `config/example.env` into a release bundle). No secret is required by
 * the current real-prediction stack — every variable here is either a
 * boolean switch, an enum, a bounded integer, or a non-secret directory
 * path/version pin.
 */

export type EnvVarCategory = "public" | "private";
export type EnvVarType = "boolean" | "string" | "enum" | "integer";

export interface EnvVarSchemaEntry {
  readonly name: string;
  readonly category: EnvVarCategory;
  readonly type: EnvVarType;
  readonly required: boolean;
  readonly enumValues?: readonly string[];
  readonly defaultValue: string;
  readonly description: string;
  /** Only enforced when `validate(..., { strictProduction: true })`. */
  readonly strictProductionRule?: string;
}

export const ENVIRONMENT_SCHEMA_ENTRIES: readonly EnvVarSchemaEntry[] = [
  // Real prediction (apps/web/src/server/prediction/config.ts)
  { name: "REAL_PREDICTION_ENABLED", category: "private", type: "boolean", required: false, defaultValue: "true", description: "Master kill switch for the historical-real-model routes." },
  { name: "REAL_PREDICTION_SOURCE_MODE", category: "private", type: "enum", required: false, enumValues: ["local-generated", "runtime-package"], defaultValue: "local-generated", description: "Which data source the real-prediction backend reads from.", strictProductionRule: "must be \"runtime-package\" — \"local-generated\" reads a developer-machine-generated directory that will not exist in a production release." },
  { name: "REAL_PREDICTION_RUNTIME_PACKAGE_DIR", category: "private", type: "string", required: false, defaultValue: "(resolved relative to the package's own location)", description: "Directory the runtime package is mounted/staged at. Only consulted in runtime-package mode." },
  { name: "REAL_PREDICTION_REQUIRE_RUNTIME_PACKAGE", category: "private", type: "boolean", required: false, defaultValue: "false", description: "When true, a missing/invalid runtime package fails loud at first use instead of a normal unavailable state.", strictProductionRule: "should be \"true\" — a production release should fail fast, not silently degrade." },
  { name: "REAL_PREDICTION_EXPECTED_RUNTIME_PACKAGE_VERSION", category: "private", type: "string", required: false, defaultValue: "(unset — any version accepted)", description: "Optional pinned runtimePackageVersion; a mismatch is reported as runtime_package_version_mismatch.", strictProductionRule: "should be set to the release manifest's own runtimePackageVersion — pins the deployed package to the version this release was validated against." },
  { name: "REAL_PREDICTION_CATALOG_LIMIT", category: "private", type: "integer", required: false, defaultValue: "50", description: "Upper bound on any single historical-catalog response (clamped 1-200)." },

  // Model inference (services/model-inference/src/config.ts)
  { name: "MODEL_INFERENCE_ARTIFACT_DIR", category: "private", type: "string", required: false, defaultValue: "(resolved relative to the package's own location)", description: "Local filesystem directory containing the model artifact's files. Only directly relevant in local-generated source mode — in runtime-package mode, the package's own model/ directory is used instead." },
  { name: "MODEL_INFERENCE_REQUIRE_MODEL_ON_START", category: "private", type: "boolean", required: false, defaultValue: "false", description: "When true, a missing/invalid model artifact fails loud at process start.", strictProductionRule: "should be \"true\" in a production release." },
  { name: "MODEL_INFERENCE_EXPECTED_MODEL_VERSION", category: "private", type: "string", required: false, defaultValue: "(unset — any version accepted)", description: "Optional pinned modelVersion; a mismatch is reported as requested_model_version_mismatch." },
  { name: "MODEL_INFERENCE_STRICT_HASH_VALIDATION", category: "private", type: "boolean", required: false, defaultValue: "true", description: "Verifies every artifact file's content hash before use." },
  { name: "MODEL_INFERENCE_MAX_REQUEST_BYTES", category: "private", type: "integer", required: false, defaultValue: "262144", description: "Per-request size ceiling (clamped 1024-1048576 bytes)." },
  { name: "MODEL_INFERENCE_TIMEOUT_MS", category: "private", type: "integer", required: false, defaultValue: "5000", description: "Inference timeout in milliseconds (clamped 100-30000)." },

  // Application
  { name: "NODE_ENV", category: "public", type: "enum", required: false, enumValues: ["development", "production", "test"], defaultValue: "development", description: "Standard Node/Next.js environment mode.", strictProductionRule: "must be \"production\"." },
  { name: "PORT", category: "private", type: "integer", required: false, defaultValue: "3000", description: "Port the Node server binds to (consumed by `next start` / a container entrypoint, not read by application code directly)." },
  { name: "HOSTNAME", category: "private", type: "string", required: false, defaultValue: "0.0.0.0", description: "Bind address (consumed by `next start` / a container entrypoint)." },
  { name: "NEXT_PUBLIC_SITE_URL", category: "public", type: "string", required: false, defaultValue: "http://localhost:3000", description: "Absolute base URL used to generate robots.txt and sitemap.xml." },
];

export interface EnvironmentValidationError {
  readonly name: string;
  readonly reason: string;
}

export interface EnvironmentValidationResult {
  readonly valid: boolean;
  readonly errors: readonly EnvironmentValidationError[];
}

function validateEntry(entry: EnvVarSchemaEntry, rawValue: string | undefined, strictProduction: boolean): EnvironmentValidationError | undefined {
  if (rawValue === undefined) {
    if (entry.required) return { name: entry.name, reason: "is required but unset." };
    return undefined;
  }
  if (entry.type === "boolean" && rawValue.trim().toLowerCase() !== "true" && rawValue.trim().toLowerCase() !== "false") {
    return { name: entry.name, reason: `must be "true" or "false", got "${rawValue}".` };
  }
  if (entry.type === "enum" && entry.enumValues && !entry.enumValues.includes(rawValue)) {
    return { name: entry.name, reason: `must be one of [${entry.enumValues.join(", ")}], got "${rawValue}".` };
  }
  if (entry.type === "integer" && !Number.isFinite(Number.parseInt(rawValue, 10))) {
    return { name: entry.name, reason: `must be an integer, got "${rawValue}".` };
  }
  if (strictProduction && entry.strictProductionRule) {
    if (entry.name === "REAL_PREDICTION_SOURCE_MODE" && rawValue !== "runtime-package") {
      return { name: entry.name, reason: entry.strictProductionRule };
    }
    if (entry.name === "REAL_PREDICTION_REQUIRE_RUNTIME_PACKAGE" && rawValue.trim().toLowerCase() !== "true") {
      return { name: entry.name, reason: entry.strictProductionRule };
    }
    if (entry.name === "MODEL_INFERENCE_REQUIRE_MODEL_ON_START" && rawValue.trim().toLowerCase() !== "true") {
      return { name: entry.name, reason: entry.strictProductionRule };
    }
    if (entry.name === "NODE_ENV" && rawValue !== "production") {
      return { name: entry.name, reason: entry.strictProductionRule };
    }
  }
  return undefined;
}

/**
 * `strictProduction: true` additionally rejects `local-generated` source
 * mode and any "fail silently" combination — TASK-049 section 8's
 * requirement that local-generated mode is rejected in production release
 * validation unless explicitly allowed for development.
 */
export function validateEnvironment(env: Readonly<Record<string, string | undefined>>, options: { readonly strictProduction: boolean }): EnvironmentValidationResult {
  const errors: EnvironmentValidationError[] = [];
  for (const entry of ENVIRONMENT_SCHEMA_ENTRIES) {
    const error = validateEntry(entry, env[entry.name], options.strictProduction);
    if (error) errors.push(error);
  }
  return { valid: errors.length === 0, errors };
}

export interface EnvironmentSchemaDocument {
  readonly configSchemaVersion: string;
  readonly variables: readonly EnvVarSchemaEntry[];
}

export function buildEnvironmentSchemaDocument(): EnvironmentSchemaDocument {
  return { configSchemaVersion: PRODUCTION_CONFIG_SCHEMA_VERSION, variables: ENVIRONMENT_SCHEMA_ENTRIES };
}

/** Placeholder-only example env content — never a real local value. */
export function buildExampleEnvContent(): string {
  const lines = [`# Generated by @repo/release-pipeline — configSchemaVersion ${PRODUCTION_CONFIG_SCHEMA_VERSION}`, "# All values below are placeholders/defaults, never real local values.", ""];
  for (const entry of ENVIRONMENT_SCHEMA_ENTRIES) {
    lines.push(`# ${entry.description}`);
    if (entry.strictProductionRule) lines.push(`# Production: ${entry.strictProductionRule}`);
    lines.push(`# ${entry.name}=${entry.defaultValue}`, "");
  }
  return lines.join("\n");
}
