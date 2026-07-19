# VLR Feature Engineering

Version: 1.0 (TASK-044)

Status: Complete. Produces a deterministic, leakage-safe, auditable feature-engineering pipeline over the TASK-043 curated dataset (432 eligible matches, 16 events), exporting model-ready temporal feature tables for TASK-045 training and backtesting. No model has been trained. No production prediction output has changed.

---

## Purpose

TASK-043 produced a clean, quarantine-aware curated dataset — but it is not yet usable for match prediction, because nothing in the repository turns raw match/roster/event history into pre-match features without risking leakage (a feature that accidentally encodes the outcome it's trying to predict, or a future match's information reaching an earlier one). TASK-044 builds that pipeline: a chronological, provider-neutral feature-state engine; team/map/roster/head-to-head/schedule/context feature groups; a deterministic Elo baseline; a canonical flat feature-row schema; a machine-readable feature catalog; temporal train/validation/test splits and walk-forward folds; and a validation framework that actively checks for leakage rather than merely assuming its absence.

This document does not claim any model has been trained. Prediction Studio still uses synthetic VCT profiles, unchanged.

---

## Source curated dataset

- 432 curated, training-eligible completed matches; 16 approved events; 334 unique VLR player IDs; 4,318 roster appearances.
- `curatedDatasetVersion: 1e8277b10be2f84a` (unchanged by this task — TASK-044 never writes to `curated/`).
- Read from `services/vlr-ingestion/.local/vlr-data/curated/{matches,events,dataset-manifest}.json` only — `teams.json`/`players.json`/`roster-appearances.json`/`quality-issues.json`/`quarantine.json`/`identity-mappings.json` are not read, since every field TASK-044 needs (roster snapshots, quality flags, training eligibility) is already embedded directly on each `NormalizedMatch`/`NormalizedEvent` record.

---

## Anti-leakage design

Three complementary defenses, none of which the others depend on:

1. **Architectural** — the state engine (below) only ever reads mutable per-team/per-player/per-pair state that reflects strictly-earlier timestamp groups, and only mutates that state after every row in the current group has already been built.
2. **Test-level** — `stateEngine.test.ts` and `task044FeaturePipeline.test.ts` explicitly assert: a match's own result never affects its own row; reversing input order produces byte-identical output; two matches at the exact same timestamp never see each other's result; a 2026 match's history is visible to a later 2026 row but never to an earlier 2025 row.
3. **Validation-level** — `featureValidation.ts`'s `crossCheckPriorMatchCounts` independently recomputes every row's prior-match count directly from the raw match list (via `timestampMs < rowMs`, entirely bypassing the state engine's own code path) and fails the build if it ever disagrees. This is the same "strictly less than" rule the state engine enforces, verified through a second, unrelated implementation.

---

## Chronological state engine

`feature/stateEngine.ts` (`runFeatureStateEngine`) is the single place chronology and mutation order are enforced:

1. Matches with no unambiguously-normalized `scheduledAt.iso` are rejected outright — never guessed a position (0 such matches exist in the current curated dataset).
2. Remaining matches are sorted ascending by `scheduledAt.iso`, then grouped by exact timestamp equality (`feature/chronology.ts`); ties within a group break on `internalId` (stable, contains the provider match ID).
3. **Emit phase**: every match in a group reads team/player/H2H/event-congestion state and builds its feature row, using only state mutated by strictly-earlier groups.
4. **Update phase**: only after every row in the group exists does each match's result get applied — team stats, Elo, head-to-head history, player appearances, event congestion, and the running Elo-median tracker.

Two matches sharing an identical timestamp therefore always see the identical pre-group state and never influence each other, satisfying the "group identical timestamps, emit all rows from the same pre-group state, then apply all results" policy.

---

## Feature groups

| Group | Fields (×2 for team A/B unless noted) | Notes |
|---|---|---|
| team-cumulative | 9 → 18 | Career matches/wins/losses/maps, cold-start flag |
| team-recent-form | 14 → 28 | Last 3/5/10 matches, last 30/60 days, form trend |
| rating | 2 → 4 (+1 match-level) | Elo rating, win probability, rating diff (rating *version* lives in the lineage group) |
| opponent-strength | 7 → 14 | Avg opponent Elo/win-rate (last 5/10), SoS, wins/losses vs above/below-median opponent |
| map-history | 9 → 18 (+2 match-level) | Pool breadth, concentration, entropy, unknown-map count, round averages, attack/defense split, pool overlap, strength differential |
| schedule-rest | 12 → 24 (+2 match-level) | Days/hours since last match, 7/14/30-day windows, back-to-back, congestion |
| roster-player | 15 → 30 | Continuity, shared history, player experience aggregates, debut count |
| head-to-head | 11 (match-level only) | Prior meetings, win rate, map differential, recency windows, same-family/region context |
| event-context | 10 (match-level only) | Family, region, stage, level, season/month, international/league/Masters-Champions flags |
| identifier | 6 (match-level only) | Match/event/team provider IDs, scheduled timestamp |
| lineage | 4 (match-level only) | Source dataset / feature schema / feature rules / Elo rating versions |
| label | 4 (match-level only) | Targets, kept structurally separate from every input feature |

**176 total columns per row**: 18+28+4+14+18+24+30 = 136 team-level (×2 sides already folded in) + 1+2+2+11+10 = 26 match-level features + 6 identifier + 4 lineage + 4 label = 176. `featureCount` in the manifest (**162**) excludes the identifier/lineage/label groups — it is the actual model-input column count.

---

## Elo configuration

`feature/versions.ts` — `DEFAULT_ELO_CONFIG`: initial rating **1500**, K-factor **24**, `ratingVersion: "vlr-elo@1.0.0"`. Deliberately conservative: a binary win/loss update only, **no margin-of-victory multiplier** — map/series score margin is not treated as a validated strength signal. Pre-match rating and Elo-implied win probability are always exported before the match's own update is applied; forfeits/quarantined matches are excluded upstream by TASK-043's curated export and never reach the Elo update. This is a baseline feature signal for TASK-045, not a claim of a production model.

## Opponent-strength median policy

`WinsVsAboveMedianOpponentCount`/`LossesVsBelowMedianOpponentCount` compare each historical opponent's frozen pre-match Elo against a running median (`feature/median.ts`) computed strictly from ratings observed in earlier timestamp groups — read once at the start of a group's update phase, and only updated with the current group's own ratings after that group's updates are fully applied. A group's own median therefore never includes its own matches.

## Recent windows

Match-count windows (3/5/10) use `Array.slice(-N)` over each team's chronological history; day-based windows (7/14/30/60/90/180/365, depending on group) use `timestampMs >= now - N*86400000` strictly against the current match's own timestamp — never an inclusive boundary that could admit the current match itself.

## Map policy

An unplayed placeholder (`"N/A"`, `"TBD"`, empty, a skipped decider) is excluded entirely — never counted as played, never as "unknown." An unrecognized-but-actually-played map increments `UnknownMapCount` without being added to map-pool breadth/concentration/entropy. **The current match's own map identities are never used as a pre-match input** — the curated schema records no veto order or pre-match map-announcement timestamp, so there is no evidence a map selection was known before kickoff; map fields are post-match/label metadata only (`labelMapCountPlayed`). Aggregate map-pool overlap (`knownMapPoolOverlapCount`) and each team's own historical map-pool signals remain safe, since they only summarize matches strictly before the current one.

## Roster policy

Roster continuity, shared-history, and player-experience features are derived strictly from each match's own recorded roster snapshot — never a team's current/future roster page. A missing or single-team-only snapshot sets `RosterSnapshotAvailable=false` with neutral defaults rather than excluding the row (0 matches in the curated dataset currently need this fallback; TASK-043 documented 3 incomplete-roster warnings that resolved to full snapshots by curation time).

## Head-to-head

Keyed by the unordered team pair so a rematch with roles reversed is still recognized as the same rivalry; `snapshot()` re-orients every stored record to the querying match's own team A/B before aggregating wins/map differential, so orientation is never a source of inconsistency.

## Schedule/rest

`InactivityFlag` (>30 days), `IsBackToBack` (<24 hours), and `SameDayMatchCountBeforeGroup` all key off `DaysSinceLastMatch`, which is `null` (never a fabricated 0) for a team's first-ever match; `HasPriorMatch` is the explicit missingness indicator. Tournament congestion is measured at the event level (matches under the same event in the trailing 3 days) — no venue/stage-schedule field exists to measure it more granularly.

## Event/context

Every context field (family, region, stage, level, season/month, format) comes directly from the event/match record itself, known at scheduling time — never derived from anything that happens during or after the match.

## Region/Team Metadata Policy

`teams.json` (TASK-043's curated team audit) carries no region field, and no per-team display name is captured anywhere in the normalized schema (a documented TASK-043 limitation). TASK-044 therefore never infers a team's home region from a single opponent or display name. Event region (a real, known-before-kickoff signal) is used for `eventRegion` and `h2hMeetingsSameEventRegion`; a standalone same-region/cross-region **team** matchup indicator is deliberately omitted and recorded as excluded in the feature-feasibility audit.

## Missing-value policy

- Numeric rates default to a neutral **0.5** prior only when the underlying sample count is genuinely zero (always exported alongside the count, so a thin/empty window is visible).
- Counts default to **0**.
- Elo uses the configured **initial rating (1500)**.
- Rest/roster-recency fields use **`null`** plus an explicit boolean missingness flag (`HasPriorMatch`, `RosterSnapshotAvailable`) — never a fabricated value.
- Categorical fields use an explicit **`"unknown"`** category — never guessed.
- No `NaN`, no `Infinity`, no implicit `undefined` ever appears in an exported row; `featureValidation.ts` fails the build if one does.

## Label policy

`labelTeamAWin` (0/1), `labelWinnerProviderId`, `labelSeriesScore` (e.g. `"2-1"`), and `labelMapCountPlayed` are derived strictly from `winnerId`/`maps` and rejected (not exported) when `winnerId` is null or matches neither competing team — 0 such rejections in the current dataset (TASK-043's curated export already excludes the two known forfeits). Labels are a structurally distinct group from every feature (`buildMatchLabels` never touches team/player/H2H state).

## Temporal splits

Chronological, count-based boundaries computed from the actual row distribution (never a guessed calendar date): **70% train / 15% validation / 15% test**.

| Split | Rows | Boundary (exclusive end) | Cold-start rate |
|---|---|---|---|
| Train | 302 | through 2026-04-22T14:10:00.000Z | 9.9% |
| Validation | 64 | through 2026-05-10T04:00:00.000Z | 0.0% |
| Test | 66 | through end of dataset | 0.0% |

Walk-forward folds (`feature/splits.ts`, expanding window, 20% warm-up, 5 folds): fold validation windows never overlap their own train window, and train strictly grows fold-over-fold (86 → 155 → 224 → 293 → 362 rows).

## Feature catalog

`feature/featureCatalog.ts` — every one of the row's 176 columns has one lineage entry (name, type, description, source fields, transformation, temporal-availability rule, missing-value policy, leakage risk, feature group, version introduced). `feature-catalog.json` is the machine-readable export; `pnpm ingest:vlr:features:catalog` prints the human-readable, group-by-group report. `featureCatalog.test.ts` proves the catalog's field set matches a real generated row's keys exactly, in both directions.

## Export format

`services/vlr-ingestion/.local/vlr-data/features/` (gitignored, same as `curated/`):

`feature-rows.json`, `feature-rows.jsonl`, `labels.json`, `feature-catalog.json`, `split-assignments.json`, `walk-forward-folds.json`, `feature-validation.json`, `feature-manifest.json`, `feature-audit.json`.

Every file is stably serialized (sorted keys, fixed indent, via the same `stableStringify` TASK-043 already uses) and content-hashed. Only `feature-manifest.json` and `feature-audit.json` carry a per-run `generatedAt` timestamp — every other file is byte-identical between two builds of unchanged input.

## Dataset versioning

`feature/featureVersion.ts` — `featureDatasetVersion` is a SHA-256 hash (truncated to 16 hex characters, never a random UUID) over the feature schema/rules version, the Elo rating configuration, the source curated dataset version, and the sorted content hash of every row. Changing `kFactor` (or any rating-config value) changes the version; rebuilding with identical curated input and configuration reproduces it exactly.

## Commands

| Command | Network | Writes | Purpose |
|---|---|---|---|
| `pnpm ingest:vlr:features:audit` | No | No | Feature-feasibility audit against the real curated dataset |
| `pnpm ingest:vlr:features:build` | No | `features/` only | Full deterministic feature export |
| `pnpm ingest:vlr:features:validate` | No | No | Hard validation gate; exits non-zero on any fatal error |
| `pnpm ingest:vlr:features:status` | No | No | Read-only summary of the current feature export |
| `pnpm ingest:vlr:features:catalog` | No | No | Human-readable feature lineage report |
| `pnpm ingest:vlr:features:splits` | No | No | Split boundaries, diagnostics, and walk-forward fold summary |

Every command reads only `curated/`; none ever writes to it.

## Validation

`pnpm ingest:vlr:features:validate` against the real dataset: **432 rows, 0 rejected matches, 0 errors, 0 warnings** — including the independent leakage cross-check, catalog-mismatch check, NaN/Infinity scan, rate-bounds check, negative-count check, label-mismatch recheck, and split-overlap check.

## Performance

Full replay of 432 matches: **~270ms**, well within "comfortable on local development hardware." Each team maintains a bounded rolling history (no repeated full-dataset scans per row); the one dataset-wide operation (the running Elo-median) is a sorted-copy median over at most ~860 observations, trivial at this scale.

## Actual counts (this run)

- Source: 432 curated matches, 16 events, `curatedDatasetVersion: 1e8277b10be2f84a` (unchanged).
- Feature rows: **432**, 0 rejected.
- Columns per row: **176** (162 features + 6 identifiers + 4 lineage-version fields + 4 labels).
- `featureDatasetVersion`: **64591ef5a24f9a0b**.
- Splits: 302 train / 64 validation / 66 test.
- Walk-forward folds: 5.
- Cold-start rows (either team's first match): 30/432 (6.9%).

## Known limitations

- Dataset size (432 matches) means several teams remain in or near cold-start through much of the timeline.
- 22 of 32 currently-supported teams still lack internal-registry mapping (unaffected — TASK-044 uses provider IDs throughout and never required internal mapping).
- No player handle/rename identity — provider ID is the only player identity axis (TASK-043 known limitation, unchanged).
- No map veto/selection-order data — current-match map identity is target metadata only, never a feature.
- No patch field anywhere in the normalized schema.
- No team home-region evidence — a same/cross-region **team** matchup indicator is not produced (see Region/Team Metadata Policy).
- No model has been trained. No frontend integration. No scheduler.

## Next step

TASK-045: model training and backtesting over `services/vlr-ingestion/.local/vlr-data/features/` (Elo/team/map/roster/H2H/schedule/context features, the chronological train/validation/test split, and the walk-forward folds) — model selection, hyperparameter tuning, and any learned preprocessing (scalers, target/frequency encoding) are all explicitly deferred to that task and must be fit only on training folds.
