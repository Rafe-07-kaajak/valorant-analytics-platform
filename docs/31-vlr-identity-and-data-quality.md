# VLR Identity Resolution and Data-Quality Hardening

Version: 1.0 (TASK-043)

Status: Complete. The TASK-042 historical dataset (434 completed matches, 16 events) has been audited, reconciled, quarantined where warranted, and exported as a deterministic curated dataset. Zero unresolved fatal mapping conflicts; zero unaccounted current-approved matches; the dataset was already fully reconciled (0 stale/out-of-scope/orphaned records) going in.

---

## Purpose

TASK-042 produced a real, backfilled historical dataset — but left team-mapping coverage at 10/32 supported teams, no player identity model, no formal reconciliation between the discovery manifests and the normalized store, no severity-ranked quality-issue ledger, no quarantine policy, and no curated export for downstream feature engineering. TASK-043 builds all of that on top of the existing ingestion foundation (TASK-041) and historical backfill (TASK-042) without modifying either's core pipeline: identity models for teams and players, an alias registry, roster-timeline hardening, event/match reconciliation, duplicate-match diagnostics, score/winner/map/timestamp hardening, a fixed-vocabulary quality-issue severity framework, a quarantine policy, hardened training-eligibility, and a deterministic curated dataset export.

This document does not claim the production website consumes VLR-sourced data. Prediction Studio still uses synthetic VCT profiles, unchanged.

---

## Baseline TASK-042 dataset

- 434 normalized completed matches, 16 included events, all six approved families represented.
- 10 of 32 currently-supported teams verified-mapped; 43 unique unmapped VLR team IDs.
- 0 unresolved ingestion failures; `pnpm ingest:vlr:validate` (TASK-042's completeness gate) passes with 0 failures, 3 warnings (incomplete roster snapshots).

---

## Team identity strategy

`identity/teamMapping.ts` (extended, not replaced) now carries an optional `status` (`verified`/`provisional`/`conflicted`/`retired`), `confidence` (`authoritative`/`high`/`low`), an `evidence` array, `verifiedAt`, and `sourceUrl` on every `VlrTeamMappingEntry`, defaulting to `verified`/`authoritative` for the 10 pre-existing entries (which were already manually verified exact-ID mappings). Every existing function (`validateTeamMappingRegistry`, `resolveTeamIdentity`, `findAliasCandidates`) is unchanged and remains backward-compatible; conflicting mappings for the same VLR team ID still fail validation.

`identity/teamLifecycle.ts` adds a provider-neutral rename/lifecycle model (`TeamLifecyclePeriod`, `detectRenames`, `detectSharedDisplayNames`) operating over caller-supplied name observations — same VLR ID with two distinct names is a same-ID rename; two VLR IDs sharing a display name is reported, never merged.

## Player identity strategy

`identity/playerIdentity.ts` is new: VLR player ID is authoritative (`resolvePlayerIdentity` reuses `deterministicInternalId`); handle-based functions (`buildPlayerHandleHistory`, `detectDuplicateHandles`) exist and are unit-tested but cannot be exercised against the real dataset today — see "Known limitations."

## Alias policy

`identity/teamAliasRegistry.ts` is a standalone registry (distinct from `VlrTeamMappingEntry.aliases`, which remains per-mapping diagnostic-only). `validateTeamAliasRegistry` detects a collision when the same case/punctuation/diacritic-normalized alias is assigned to two different canonical teams — never auto-resolved. Seeded with 2 entries (`KRÜ Esports` display-name + ASCII transliteration), 0 collisions.

## Mapping evidence policy

Every verified mapping entry carries `evidence`, `sourceUrl`, and `verifiedAt`; a display-name-only match (`findAliasCandidates`) can never create a mapping. `mapping/mappingImport.ts` validates an externally-supplied `team-mappings.json` (schema validation, conflict detection against the current registry and within the payload itself, prototype-pollution-safe `JSON.parse`) and produces an added/changed/rejected report — it never writes generated source; a verified mapping is always added to `identity/teamMapping.ts` by hand, the same way every existing entry was.

## Roster timeline

`quality/rosterQuality.ts` audits every match's roster snapshots (duplicate player within one team, player on both teams, incomplete/implausible roster size — never forced to 5/5) and builds a deterministic player→team appearance timeline (`buildPlayerTeamAppearanceTimeline`) strictly from observed snapshots, never inferring membership beyond match evidence.

## Event reconciliation

`reconciliation/eventReconciliation.ts` classifies every persisted normalized event record and every current manifest entry into one of six categories (`current-approved`, `superseded`, `stale`, `out-of-scope`, `orphaned`, `audit-only-historical`), by comparing the current event discovery manifest against `listNormalizedEntityIds("event")` (new `persistence/types.ts` capability, reading each record's own `internalId` field — never reconstructing an ID from its filesystem-encoded filename).

## Stale-record handling

`reconciliation/matchReconciliation.ts` does the same one level down, additionally checking each match's parent-event category (a match under a since-excluded event is `out-of-scope` even though the match record itself is unchanged). Nothing is deleted by default. `pnpm ingest:vlr:cleanup` (new) defaults to a dry run; `--delete` is required to actually remove `stale`/`orphaned` records (never `out-of-scope`, which a rules change could legitimately restore).

## Duplicate detection

`quality/duplicateDetection.ts` groups matches by unordered team pair and classifies same-day/same-event/same-format/same-map-sequence pairs as `cross-event-listing-duplicate` (high confidence) or `semantic-duplicate-candidate` (low confidence, review only); a different day/format/map-sequence pair is `rematch-not-duplicate`. Provider match ID remains the only automatic dedup key — two distinct match IDs are never merged.

## Score/winner validation

`quality/scoreConsistency.ts` re-derives winner/score invariants directly from the persisted record (defense-in-depth over TASK-042's normalization-time checks): winner must be one of the two competing teams, map winner must agree with its score, negative scores are impossible, and a series win count that doesn't clinch its declared format is flagged `forfeit` (if any maps were played) or `inconsistent_series_winner` (fatal, if none were). The attack/defense-split check only flags a split that **exceeds** the total score (an actual impossibility) — not one that falls short, since VLR's real markup does not extend that split into overtime rounds, so a shortfall there is expected, not an error.

## Map handling

`quality/mapHardening.ts` adds an explicit `unplayed_map_placeholder` category (`"N/A"`, `"TBD"`, empty, etc.) distinct from `unknown_map`, so a real future map is never confused with a non-map placeholder. `normalize/mapNormalization.ts`'s known-map table is unchanged; no automatic remapping to the closest known map ever happens.

## Timestamp handling

`quality/timestampHardening.ts` cross-checks each match's normalized timestamp against both the approved scope window and its parent event's own date range — a soft, warning-level check, since a match starting hours before an event's officially-listed start date is a real, benign discrepancy in VLR's own listing data (see "Actual results").

## Severity framework

`quality/qualityIssue.ts` defines the fixed vocabulary from TASK-043's specification (22 codes, `info`/`warning`/`error`/`fatal`/`quarantined` severities), each `QualityIssue` carrying a stable code, entity reference, safe message, source reference, first/latest-detected timestamps, and resolution status. `mergeQualityIssues` preserves `firstDetectedAt` across repeated audit runs.

## Quarantine policy

`quality/quarantine.ts` quarantines a match when: provider identity is missing, teams are unidentifiable, the winner is inconsistent, a completed match has zero played maps, a fatal-severity issue exists, or reconciliation categorized it `stale`/`out-of-scope`/`orphaned`. A quarantined record is never deleted — it's routed to `quarantine.json` instead of `matches.json` in the curated export, and the quarantine ledger (`discovery/quarantine-ledger.json`) preserves `firstQuarantinedAt` across repeated `curate` runs.

## Training-eligibility policy

`quality/trainingEligibilityHardened.ts` wraps (never replaces) TASK-042's preliminary `evaluateTrainingEligibility`, adding: current-approved-manifest membership, non-quarantined status, and a stable (not necessarily internally-mapped) team identity. It does **not** additionally require full 32-team mapping, a complete roster, attack/defense splits, or a known patch.

## Curated dataset format

`curate/curatedExport.ts` writes nine deterministic files to `<dataDir>/curated/`: `teams.json`, `players.json`, `events.json`, `matches.json`, `roster-appearances.json`, `identity-mappings.json`, `quality-issues.json`, `quarantine.json`, `dataset-manifest.json`. Only `current-approved` and non-quarantined records ever appear in `matches.json`/`events.json`; quarantined matches are written separately, never dropped. Every file is stably serialized (sorted object keys, fixed 2-space indent) via `stableStringify`.

## Dataset versioning

`curate/curatedVersion.ts` extends dataset identity with an `identityMappingVersion` (hash of the team-mapping/alias registry content) and the existing `QUALITY_RULES_VERSION` constant, combined with the source dataset version and the sorted curated match content hashes into `curatedDatasetVersion` — a SHA-256 hash, truncated to 16 hex characters, never a random UUID.

## Commands

| Command | Network | Purpose |
|---|---|---|
| `pnpm ingest:vlr:identity:audit` | No | Baseline team/player/event identity audit |
| `pnpm ingest:vlr:identity:teams` | No | Team mapping + alias report |
| `pnpm ingest:vlr:identity:players` | No | Player identity report |
| `pnpm ingest:vlr:quality:audit` | No | Full match-facing quality-issue ledger, persisted |
| `pnpm ingest:vlr:quality:reconcile [--dry-run]` | No | Event/match reconciliation against current manifests |
| `pnpm ingest:vlr:quality:validate` | No | Hard validation gate; exits non-zero on any fatal issue |
| `pnpm ingest:vlr:curate` | No | Generates the deterministic curated dataset |
| `pnpm ingest:vlr:curated:status` | No | Read-only summary of the curated export |
| `pnpm ingest:vlr:cleanup [--delete]` | No | Dry-run by default; explicit `--delete` removes stale/orphaned records only |
| `pnpm ingest:vlr:mapping:import -- <file>` | No | Validates an external team-mapping file; dry-run report only |

Every command above reads only the already-persisted store/manifests; none makes a network request.

## Network policy

No broad live requests were made during TASK-043. All commands above operate entirely on the existing local TASK-042 dataset. Extending team-mapping coverage toward the remaining 22 unresolved supported teams would require fetching each unmapped VLR team's page to read its display name (no team name is captured anywhere in the currently-normalized schema); this was deliberately deferred rather than run as a ~43-request crawl, since it was judged not narrowly-scoped enough to qualify as the "small number of conservative live requests" the task allows, and every unresolved entry is left explicitly pending rather than guessed.

---

## Actual results (this run)

- **Teams:** 53 unique VLR team IDs observed across the dataset; 10 mapped (verified, authoritative), 43 unmapped. 0 duplicate/conflicting mappings. 10/32 currently-supported teams resolved; 22 remain unresolved: `furia, g2-esports, leviatan, loud, mibr, eternal-fire, fnatic, fut-esports, gentle-mates, team-liquid, detonation-focusme, full-sense, kiwoom-drx, nongshim-redforce, rex-regum-qeon, t1, dragon-ranger-gaming, edward-gaming, jdg-esports, titan-esports-club, trace-esports, tyloo`.
- **Players:** 334 unique VLR player IDs, 4,318 roster appearances, 3 incomplete roster snapshots (matches TASK-042's 3 documented warnings). Handle-based duplicate/rename detection is not derivable from the current dataset (handles aren't captured — see "Known limitations").
- **Events:** 16 unique persisted event records, 0 duplicates.
- **Quality issues:** 18 total — 2 fatal (`inconsistent_series_winner`, the two known forfeits), 16 warning (2 `incomplete_roster`, 10 `outside_date_scope` — matches starting hours before their event's officially-listed start date, a benign real-world discrepancy in VLR's own listings — and 4 `unknown_map`, all a single previously-unseen map name, `"Summit"`, appearing consistently enough to warrant investigation before being added to the known-map table with evidence). 0 semantic duplicate candidates across 182 team-pair comparisons.
- **Reconciliation:** events — 16 current-approved, 0 superseded/stale/out-of-scope/orphaned, 649 audit-only-historical. Matches — 434 current-approved, 0 superseded/stale/out-of-scope/orphaned, 74 audit-only-historical. The dataset was already fully reconciled going in.
- **Quarantine:** 2 records — the same two matches already known from TASK-042 as forfeits (completed, zero played maps, a "winner" that clinches nothing in a Bo1).
- **Training eligibility:** 432/434 eligible under the hardened evaluator — identical to TASK-042's preliminary 432/434, since reconciliation found nothing additional to exclude.
- **Curated dataset:** 432 matches, 16 events, `curatedDatasetVersion: 1e8277b10be2f84a`, `sourceDatasetVersion: 9c5d5ae55d7d0035`, `identityMappingVersion: vlr-identity-mappings@7d8e6ffc3fd9a6c5`, `qualityRulesVersion: vlr-quality-rules@1.0.0`. Idempotency proven: running `curate` twice produced byte-identical `teams.json`, `players.json`, `events.json`, `matches.json`, `roster-appearances.json`, `identity-mappings.json`, `quality-issues.json`, and `quarantine.json` — only `dataset-manifest.json`'s own `generatedAt` field differed, while `curatedDatasetVersion` itself stayed identical.
- Repository verification: `pnpm lint`, `pnpm check-types`, `pnpm test` (1,104 tests: 453 vlr-ingestion + 447 web + 204 prediction-engine), and `pnpm build` all pass. `pnpm test:e2e --workers=1` passed 79/79 with VLR network disabled.

---

## Unresolved identity conflicts

None. `validateTeamMappingRegistry` and `validateTeamAliasRegistry` both report `valid: true` against the current registries.

---

## Known limitations

- 22 of the 32 currently-supported teams remain unmapped — no team display name is captured anywhere in the currently-normalized schema (`matchDetailParser.ts`'s team-ID extraction discards the URL slug), so resolving them requires either a live team-page fetch per unmapped ID or a parser enhancement plus a fresh backfill; neither was done this task to avoid an uncontrolled live crawl.
- Player handles are not captured anywhere in the current normalized schema — the handle-based identity functions (`buildPlayerHandleHistory`, `detectDuplicateHandles`) are built and unit-tested but cannot surface any real findings against today's dataset.
- Team rename/lifecycle detection (`identity/teamLifecycle.ts`) operates on caller-supplied name observations; no such observations exist in the current dataset (same limitation as team names generally).
- The one previously-unseen map name (`"Summit"`) was left flagged as `unknown_map` rather than added to the known-map table, since no live verification confirmed it as an official competitive map within this task.
- Filesystem storage only — no production database, consistent with TASK-041/042.
- No feature engineering, no model, no frontend integration, no scheduler — all explicitly out of scope for TASK-043.

## Next step

TASK-044: feature engineering over the curated dataset (`teams.json`, `matches.json`, `roster-appearances.json`, etc.) — Elo/Glicko/form/map-rating computation, model training, and backtesting are all explicitly deferred to that task.
