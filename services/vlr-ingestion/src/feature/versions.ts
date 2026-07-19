/**
 * TASK-044 feature-engineering versioning. Bumping any of these signals that
 * re-running the feature build against identical curated input data should
 * intentionally produce a new `featureDatasetVersion` — mirrors the
 * `QUALITY_RULES_VERSION` / `curate/curatedVersion.ts` pattern from
 * TASK-043, extended with a new axis (rating configuration).
 */
export const FEATURE_SCHEMA_VERSION = "vlr-feature-schema@1.0.0";
export const FEATURE_RULES_VERSION = "vlr-feature-rules@1.0.0";

export interface EloConfig {
  readonly initialRating: number;
  readonly kFactor: number;
  readonly ratingVersion: string;
}

/**
 * Elo baseline configuration — a feature/baseline signal for TASK-045, never
 * claimed to be the final production model. Deliberately conservative: no
 * margin-of-victory multiplier (map-score margin is not treated as a
 * reliable strength signal), a fixed K-factor, and no per-region/per-map
 * variant unless a documented need arises later.
 */
export const DEFAULT_ELO_CONFIG: EloConfig = {
  initialRating: 1500,
  kFactor: 24,
  ratingVersion: "vlr-elo@1.0.0",
};
