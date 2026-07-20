/**
 * Version constants for the release pipeline's own contracts — bumping
 * either constant deliberately changes every future `releaseVersion`
 * (both are canonical inputs to `computeReleaseVersion`), the same way
 * `RUNTIME_PACKAGE_RULES_VERSION` changes `runtimePackageVersion`.
 */
export const RELEASE_RULES_VERSION = "release-rules@1.0.0";

/** Shape of the production environment-configuration schema (`environmentSchema.ts`). A shape change (new required var, changed validation rule) should bump this. */
export const PRODUCTION_CONFIG_SCHEMA_VERSION = "release-config-schema@1.0.0";
