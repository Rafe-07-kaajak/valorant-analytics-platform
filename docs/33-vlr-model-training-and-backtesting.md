# VLR Model Training and Backtesting

Version: 1.0 (TASK-045)

Status: Complete. Trains, backtests, calibrates, and compares leakage-safe probabilistic match-winner candidates over the TASK-044 feature dataset, then selects and serializes a defensible baseline artifact for TASK-046. No frontend integration. No production inference service. Prediction Studio still uses synthetic VCT profiles, unchanged.

---

## Purpose

TASK-044 produced 432 leakage-safe, chronologically-ordered pre-match feature rows — but nothing in the repository yet turns those rows into a probability. TASK-045 builds that: a provider-neutral modeling package (feature policy, preprocessing, estimators, calibration, temporal evaluation, backtesting, artifact serialization, model selection, reporting); trains and compares non-learned baselines, regularized logistic regression, and a small gradient-boosted-tree ensemble; backtests every candidate on TASK-044's walk-forward folds; calibrates the winning candidate; evaluates the frozen model exactly once on the held-out test split; and serializes a deterministic, Node-loadable artifact.

## Source feature dataset

- `services/vlr-ingestion/.local/vlr-data/features/` — `featureDatasetVersion: 64591ef5a24f9a0b`, 432 rows, 161 candidate input columns (see "Excluded features" below), 4 label fields.
- Splits (chronological, from `split-assignments.json`): 302 train / 64 validation / 66 test.
- Walk-forward folds (from `walk-forward-folds.json`): 5 folds as built by TASK-044; TASK-045 uses only the 4 whose validation window never touches a test-split row (see "Walk-forward folds vs. the fixed test split" below).
- Target: `labelTeamAWin` (0/1). Overall Team A win rate 47.5%; by split — train 47.4%, validation 53.1%, test 42.4%. No orientation bias flag (threshold ±10 points from 50%).

## Modeling package

`services/vlr-ingestion/src/modeling/` — TypeScript, no new dependencies. Every estimator (logistic regression, gradient-boosted trees) is hand-implemented rather than pulled from a library:

- **Why TypeScript, not Python**: the repository already standardizes on a Node/TypeScript monorepo for every other service; a Python subprocess would add a second runtime, a second dependency-management story, and a serialization boundary TASK-046 would have to cross. At 432 rows and ≤190 encoded features, none of the estimators need a compiled numerical library to fit in a reasonable time (full training run: ~20s).
- **Why no ML dependency** (scikit-learn-equivalent, XGBoost/LightGBM): CLAUDE.md requires justifying every new dependency, and none of the required estimators are complex enough to need one — L2-regularized logistic regression is direct gradient descent; the required tree ensemble is bounded to depth ≤ 3 and ≤ 100 trees, well within what a straightforward hand-written CART + Friedman-style gradient boosting implementation handles correctly at this scale. Isotonic regression (pool-adjacent-violators) is ~20 lines. Adding a dependency to replace ~600 lines of well-tested, dependency-free code was not justified.

| Module | Responsibility |
|---|---|
| `io.ts` | Read-only loader over `features/*.json`; splits rows by their recorded split assignment |
| `featurePolicy.ts` | Derives numeric/boolean/categorical/excluded field buckets from `feature-catalog.json` |
| `preprocessing.ts` | Fits medians/means/std/categorical vocabularies on training rows only; applies unchanged to validation/test |
| `metrics.ts` | Log loss, Brier score, ROC AUC, accuracy, balanced accuracy, precision/recall/F1, reliability bins, ECE, calibration slope/intercept |
| `baselines.ts` | Constant 0.5, training-set class prior, Elo (reads TASK-044's own `teamAEloWinProbability`) |
| `logisticRegression.ts` | L2-regularized logistic regression, Adam optimizer, zero-initialized (fully deterministic, no seed needed) |
| `regressionTree.ts` / `gradientBoostedTrees.ts` | CART regression tree; Friedman-style gradient-boosted ensemble with Newton-step leaf values for binomial deviance loss |
| `calibration.ts` | Platt/sigmoid (reuses the logistic-regression estimator on `logit(p)`) and isotonic (pool-adjacent-violators) |
| `candidates.ts` | Predeclared hyperparameter grids; fold-model closures shared by grid search and walk-forward backtesting |
| `backtest.ts` | Walk-forward evaluation over TASK-044's precomputed folds |
| `bootstrap.ts` | Seeded bootstrap confidence intervals over already-computed predictions |
| `audit.ts` | Model feasibility audit (missingness, constants, correlation, leakage sentinels, orientation bias) |
| `errorAnalysis.ts` / `featureImportance.ts` | Diagnostics over the frozen model's final test predictions |
| `modelVersion.ts` / `artifact.ts` | Deterministic model versioning; artifact read/write |
| `inference.ts` | Offline artifact-based predictor (tests + `model:predict` CLI only — not a production service) |
| `pipeline.ts` | Orchestrates the full audit → train → backtest → calibrate → select → evaluate → serialize workflow |

## Target and excluded features

`labelTeamAWin` is the only target. Every identifier (`matchInternalId`, `providerMatchId`, `scheduledAt`, `eventInternalId`, `teamAProviderId`, `teamBProviderId`), lineage/version field, and label field (`labelWinnerProviderId`, `labelSeriesScore`, `labelMapCountPlayed`) is excluded from the model input matrix — derived programmatically from `feature-catalog.json`'s `type` field (`featurePolicy.ts`), not a hand-maintained list, so it can never silently drift from TASK-044's schema.

One additional field is excluded beyond the catalog's own identifier/label/version groups: **`h2hMostRecentMeetingWinnerProviderId`**. Its value space is an arbitrary team provider ID; one-hot encoding it would let the model memorize specific team identities through the back door even though `teamAProviderId`/`teamBProviderId` are already excluded. The same information already exists in orientation-safe numeric form via `h2hTeamAWins`/`h2hTeamBWins`/`h2hTeamAWinRate`. This leaves **161 primary model-input columns** (141 numeric, 15 boolean, 5 categorical).

**Team-identity experiment**: per requirement 5, `teamAProviderId`/`teamBProviderId` were deliberately kept out of the primary model (they are catalog "identifier" fields, never fed to any estimator here). A clearly-separated team-ID-encoding experiment was scoped but not built in this pass — with only 49 distinct teams across 432 matches and per-team sample counts often single digits, one-hot team identity would dominate a ~190-row training fold and produce unseen-team failures for any team not seen in training; the audit's cold-start count (30/432, 6.9%) and the walk-forward evidence below (see "Known limitations") already capture the unseen-team risk this experiment would otherwise quantify.

## Preprocessing

Fit strictly on the rows passed to `fitPreprocessor` (train split for the primary holdout; each fold's own train rows for walk-forward). Numeric standardization is a per-feature affine transform, which never changes which threshold a decision tree would choose on that feature — so **one preprocessing pipeline serves both the logistic and tree candidates**, rather than two divergent ones.

- Numeric: median imputation (fit on train only) for the 7 nullable fields (`teamA/BDaysSinceLastMatch`, `teamA/BHoursSinceLastMatch`, `teamA/BDaysSinceRosterLastAppearedTogether`, `restDifferenceDays`; missingness up to 16.7% for `teamADaysSinceRosterLastAppearedTogether`), followed by z-score standardization (train mean/std; zero-variance fields guarded to scale 1). A `__isMissing` indicator column is added only for a field that actually had a null in the training fold.
- Boolean: 0/1, no imputation (never null per TASK-044's validated schema).
- Categorical (`eventFamily`, `eventRegion`, `eventStage`, `tournamentLevel`, `seriesFormat`): one-hot using the training-fold vocabulary only, plus an explicit `=__unknown__` column for any category not seen in training — never a target/frequency encoding, never an ordinal assumption.
- Feature order is fixed at fit time and stored verbatim in `feature-contract.json`.

## Temporal evaluation policy

**A. Fixed holdout** — train/validation/test exactly as TASK-044 computed them (70/15/15 by count). Grid search and calibration-method selection use only train+validation. The test split is not read for any decision until step G below.

**B. Walk-forward backtesting** — TASK-044's 5 expanding-window folds (86 → 155 → 224 → 293 → 362 train rows). **Only 4 of the 5 folds are used.**

### Walk-forward folds vs. the fixed test split

TASK-044's walk-forward folds are built over the *entire* 432-row chronological dataset, independent of the fixed 70/15/15 split — the last fold's validation window is defined as "everything remaining after the 4th fold's train set," which runs to the end of the dataset and therefore overlaps 66 of the 66 fixed-test rows. Using that fold for family/hyperparameter selection would leak test labels into the freeze decision (requirement 21: "final test set remains untouched until selection is frozen"). `pipeline.ts` filters `walkForwardFolds` to the subset whose `validationMatchInternalIds` never intersect the fixed test split's match IDs before any selection evidence is computed — concretely, folds 0-3 (each fold's validation window ends at or before the fixed train/validation boundary's neighborhood; fold 4 is dropped entirely). This filtering applies uniformly to every family's walk-forward evidence and to the artifact's own reported `fold-predictions.json`, so no reported walk-forward number was ever computed from a test-labeled row. Verified directly: `fold-predictions.json` contains 0 matches present in the test split (checked programmatically; also asserted in `pipeline.integration.test.ts`).

**C. No random K-fold cross-validation** anywhere in this task.

## Baselines

| Baseline | Test log loss | Test Brier | Test accuracy | Test ROC AUC |
|---|---|---|---|---|
| Constant 0.5 | 0.6931 | 0.2500 | 0.4242 | 0.500 (undefined signal) |
| Training-set class prior (0.4735) | 0.6865 | 0.2467 | 0.5758 | 0.500 |
| Elo (TASK-044's own `teamAEloWinProbability`) | **0.6675** | **0.2374** | **0.5909** | **0.6344** |

Elo is read directly from TASK-044's already-computed, leakage-safe pre-match rating — no additional fitting needed.

## Candidates

**Logistic regression** — L2 only (elastic net was scoped but not added: no clear justification for the extra complexity at 302 training rows and 161 raw / ~190 encoded features). 3 predeclared configs (`λ ∈ {0.01, 0.1, 1.0}`, 1000 Adam iterations, learning rate 0.05), selected on primary-holdout validation log loss:

| λ | Validation log loss |
|---|---|
| 0.01 | 0.6789 |
| **0.1** | **0.6288** (selected) |
| 1.0 | 0.6438 |

**Gradient-boosted trees** — 4 predeclared configs (depth ∈ {2, 3} × learning rate ∈ {0.05, 0.1}, 100 trees, `minSamplesLeaf: 10`):

| Depth | Learning rate | Validation log loss |
|---|---|---|
| **2** | **0.05** | **0.6639** (selected) |
| 2 | 0.1 | 0.6995 |
| 3 | 0.05 | 0.7105 |
| 3 | 0.1 | 0.7734 |

No neural network. No AutoML. 7 fits for grid search + 8 walk-forward fold fits (4 folds × 2 families) + 2 final refits = **17 total model fits**.

## Backtesting (4 test-safe walk-forward folds)

Mean/median log loss per family across the 4 folds:

| Family | Mean log loss | Median log loss |
|---|---|---|
| Logistic regression (λ=0.1) | 0.7738 | — |
| Gradient-boosted trees (d=2, lr=0.05) | 0.8066 | — |
| **Elo** | **0.6759** | **0.6742** |
| Class prior | 0.6958 | — |
| Constant 0.5 | 0.6931 | — |

Elo's own fold-by-fold detail (the artifact's `evaluation.json`, since Elo is the selected family):

| Fold | Train rows | Validation rows | Validation window ends | Log loss | Brier | Accuracy |
|---|---|---|---|---|---|---|
| 0 | 86 | 69 | 2026-02-05 | 0.6968 | 0.2518 | 0.5507 |
| 1 | 155 | 69 | 2026-04-01 | 0.6586 | 0.2329 | 0.6522 |
| 2 | 224 | 69 | 2026-04-18 | 0.6797 | 0.2432 | 0.6087 |
| 3 | 293 | 69 | 2026-05-09 | 0.6687 | 0.2380 | 0.5797 |

This is the decisive evidence: on the single primary validation holdout, logistic regression (0.6288) looked *better* than what Elo would score there — but walk-forward backtesting across 4 independent expanding windows reveals it does not generalize (mean 0.7738, worse than Elo in every one of the four folds). This is exactly the scenario walk-forward evaluation exists to catch, and exactly why requirement 11 ("no single lucky split should determine the winner") drove this task to use walk-forward evidence, not the primary holdout, for family selection.

## Calibration

Not evaluated for the selected model — see "Model selection" below (a non-learned baseline needs no calibration). The calibration framework itself (`calibration.ts`) is fully implemented and unit-tested: sigmoid (Platt) calibration is always evaluated; isotonic is additionally evaluated whenever the calibration sample has ≥ 50 rows (the validation split has 64 — eligible). Selection is by validation log loss, computed and compared for both learned candidates during the pipeline run, and would be applied identically had a learned family been selected.

## Model selection

**Frozen decision: Elo baseline, no calibration.**

Rationale (computed and logged by `pipeline.ts`, not hand-edited): *"Neither learned candidate's walk-forward mean log loss (logistic 0.7738, tree 0.8066) beats the Elo baseline (0.6759) on this dataset; selecting Elo per the conservative-fallback rule (TASK-045 requirement 11) rather than a learned model chosen on noise."*

- **Test-set isolation**: neither `logisticEvidence`, `treeEvidence`, nor `eloEvidence` (the three quantities compared to freeze this decision) reads anything from `splitRows.test` — they are computed purely from primary-holdout validation metrics and the 4 test-safe walk-forward folds. The test split is read for the first time only in the pipeline's "G. Final test evaluation" step, strictly after this decision is already frozen (see `pipeline.ts`'s comment "F. Family selection — frozen using train/validation/walk-forward evidence only; test is never read above this line").
- **Simplicity tie-break rule** (`FAMILY_INDISTINGUISHABLE_LOG_LOSS_EPSILON = 0.005`) and **minimum-improvement-over-Elo rule** (`MIN_IMPROVEMENT_OVER_ELO_LOG_LOSS = 0`, i.e. a learned candidate must beat Elo's walk-forward mean log loss, not merely tie it) are both predeclared constants in `pipeline.ts`, not tuned post hoc against this dataset's result.
- Elo is also the simplest, most portable, fastest-inference, and most unseen-team-robust candidate available (a two-number-per-team rating table vs. a 161-dimension model that has never seen most of the 49 teams more than a handful of times) — every one of requirement 11's selection criteria points the same direction here.

## Final test evaluation (single pass, after freeze)

| Metric | Elo (selected) | 95% bootstrap CI (2000 resamples, seed 45045) |
|---|---|---|
| Log loss | 0.6675 | [0.6282, 0.7099] |
| Brier score | 0.2374 | [0.2182, 0.2581] |
| Accuracy | 0.5909 | [0.4697, 0.7121] |
| ROC AUC | 0.6344 | — |
| Log loss minus Elo | 0.0000 | [0.0000, 0.0000] (the selected model *is* Elo) |

66 test rows. Intervals are descriptive uncertainty, not a formal significance claim — see "Known limitations."

## Error analysis

Computed over the 66 test predictions (`errorAnalysis.ts`, embedded in the artifact's evaluation): highest-confidence misses, lowest-confidence correct calls, cold-start vs. established-team error rates, error rate by tournament level and series format, Team A/B orientation error rates, roster-incomplete rows, high-rest-imbalance rows (|restDifferenceDays| ≥ 7 days), and major model/Elo disagreement cases. Since the selected model *is* Elo, the "major Elo disagreement" bucket is trivially empty by construction — this diagnostic becomes meaningful again the moment a learned model is selected (e.g. after more data is backfilled).

## Explainability

No learned model was selected, so `feature-importance.json` reports the explicit "non-learned baseline; no feature importance applies" placeholder rather than fabricating an importance ranking. Both explainability code paths are implemented and unit-tested for when a learned family *is* selected: standardized logistic coefficients (direct from the fitted weights, since preprocessing already standardizes every numeric input) and tree permutation importance (5 repeats, seeded, computed on held-out rows only, never training rows). Both are documented as associative, not causal.

## Artifact

`services/vlr-ingestion/.local/vlr-data/models/selected-model/` (gitignored, same as `curated/` and `features/`):

`model.json`, `preprocessing.json`, `calibration.json`, `feature-contract.json`, `model-manifest.json`, `model-card.json`, `evaluation.json`, `test-predictions.json`, `fold-predictions.json`, `reliability-data.json`, `feature-importance.json`.

- **Format**: pure JSON throughout — for a tree model, the CART node structure serializes directly (no pickle, no binary blob); for logistic regression, plain coefficient/bias arrays. Both are directly loadable in Node with no Python runtime, satisfying TASK-046's portability requirement before it exists.
- **Model version**: `aa85997f41de1264` — a SHA-256 hash (16 hex chars) over `featureDatasetVersion`, the fitted preprocessing state, the estimator config, and the calibration config (`modelVersion.ts`, mirrors `feature/featureVersion.ts`'s approach exactly). Never a random UUID; unaffected by `generatedAt`.
- **Content hashes**: every non-manifest file's SHA-256 is embedded in `model-manifest.json.contentHashes`, computed via a two-phase write (write once to compute hashes, then rewrite the manifest with those hashes filled in) so the manifest can reference the other files' hashes without a self-reference cycle.

## Inference parity

`inference.ts`'s `predict()` is the same code path used by `model:predict` and by `pipeline.integration.test.ts`'s parity test: load the artifact, validate the input row against `feature-contract.json`'s required fields (rejecting missing fields and NaN/Infinity), transform with the frozen preprocessor, score with the frozen estimator, apply the frozen calibration, clamp to `[0, 1]`, and return `{ teamAWinProbability, teamBWinProbability }` summing to exactly 1. Verified in the integration test: reloading the artifact and predicting on a training-time test row reproduces that row's `predictedCalibrated` value to 9 decimal places.

## Reproducibility

- **Seed**: `45045`, used only for bootstrap resampling and permutation-importance shuffling — never for training. Logistic regression is zero-initialized (Adam optimizer, no random init); gradient-boosted trees use exhaustive greedy splitting (no row/feature subsampling) — both fits are deterministic with no seed at all.
- **Verified idempotency** (real dataset, two full `pnpm ingest:vlr:model:train` runs): `modelVersion` identical (`aa85997f41de1264` both times) and all 10 non-manifest artifact file hashes byte-identical; only `model-manifest.json`'s hash differs, because `generatedAt` is the only field allowed to vary between runs. Also verified in `pipeline.integration.test.ts` against a synthetic dataset (two runs, different `generatedAt`, identical `modelVersion`/predictions/evaluation).
- **Runtime versions**: recorded in `model-manifest.json` (`nodeRuntimeVersion` via `process.version`, `typescriptVersion` via the installed `typescript` package's own `version` export — not a hand-typed string).

## Performance

Full real-dataset run (audit + 7-config grid search + 4-fold × 2-family walk-forward + calibration evaluation + final test evaluation + bootstrap + artifact write, two-phase): **~20-27 seconds**, comfortably on local development hardware. 17 total model fits. `services/vlr-ingestion/.local/vlr-data/features/` is read-only input; nothing outside `models/` is ever written.

## Commands

| Command | Network | Writes | Purpose |
|---|---|---|---|
| `pnpm ingest:vlr:model:audit` | No | `models/model-audit.json` | Feasibility audit over the feature dataset |
| `pnpm ingest:vlr:model:train` | No | `models/selected-model/*` | Full deterministic training/backtesting/selection/artifact pipeline |
| `pnpm ingest:vlr:model:backtest` | No | No | Read-only per-fold walk-forward report |
| `pnpm ingest:vlr:model:evaluate` | No | No | Read-only validation/walk-forward/test metrics report |
| `pnpm ingest:vlr:model:calibrate` | No | No | Read-only calibration comparison + reliability report |
| `pnpm ingest:vlr:model:select` | No | No | Read-only selection rationale + candidate evidence report |
| `pnpm ingest:vlr:model:status` | No | No | Read-only artifact manifest summary |
| `pnpm ingest:vlr:model:predict -- <feature-row-file.json>` | No | No | Offline inference over a single JSON feature row |

Every command reads only `features/`; none ever writes to `features/` or `curated/`.

## Known limitations

- **432 matches is small** for a 161-feature model — the walk-forward evidence above is the direct, empirical demonstration of this: both learned families overfit the single validation holdout and underperform the two-number Elo baseline out-of-sample.
- **Event-family concentration**: Masters (88 rows) and vct-china (78) dominate; several teams remain in or near cold-start (30/432 rows, 6.9%) through much of the timeline.
- **Constant/near-constant/duplicate columns exist in the raw 161-field matrix** (`teamA/BSameDayMatchCountBeforeGroup`, `teamA/BUnknownMapCount` are constant at 0 across the current dataset; `teamA/BRosterSize`/`RosterSnapshotAvailable` are >99% one value; 12 exactly-duplicate field pairs, e.g. `isInternationalEvent`≡`isMastersOrChampions` in the current data). None were manually removed — the estimators (L2-regularized logistic regression, depth-bounded trees) are robust to them by construction, and removing them would be a modeling judgment call beyond this task's scope; documented here for TASK-046 and future feature-engineering work instead.
- **75 highly-correlated numeric pairs** (|r| ≥ 0.95) exist, mostly among the recent-form/cumulative-form field families, which is expected given they're derived from overlapping windows of the same underlying match history — not evidence of leakage (0 suspicious target correlations ≥ 0.9 were found).
- **Calibration method selection uses validation-set evidence directly** (fit and compare on the same 64-row validation split) rather than a further held-out calibration split, given the limited row count — documented, not hidden.
- **Bootstrap confidence intervals are descriptive uncertainty**, not a formal significance test; row resampling is not strictly i.i.d. given the chronological/tournament structure of the data.
- **Team-identity experiment (section 5) was scoped but not built** — see "Target and excluded features" above.
- No player handle/rename identity beyond provider ID; no map veto/selection-order data; no patch field; no team home-region evidence (all unchanged limitations inherited from TASK-043/044).
- **No live inference service, no frontend integration, no scheduler** — Prediction Studio is unchanged and still serves synthetic VCT profiles.

## Next step

TASK-046: inference-service integration. The frozen artifact at `services/vlr-ingestion/.local/vlr-data/models/selected-model/` is ready to be *loaded* (never retrained) by a production inference path — `inference.ts`'s `predict()` function is the reference implementation TASK-046 should port into a real service boundary. Because the selected model is currently the Elo baseline, TASK-046 should also decide whether to re-run `model:train` as more matches are backfilled (the pipeline is fully idempotent and one-command) before wiring a learned model into production traffic.
