# VLR Historical Backfill

Version: 1.0 (TASK-042)

Status: Real-markup verified. Live, resumable discovery reached full archive completion back through the approved scope's 2025-01-01 start date, and every discovered completed match in scope has been backfilled, normalized, or accounted for in the failure ledger. See "Actual results" below for exact counts as of the run described in this document.

---

## Purpose

TASK-041 built the ingestion foundation (provider interfaces, HTTP client, parsers, schemas, persistence, CLI) entirely against synthetic fixtures and explicitly deferred real-markup verification and the historical backfill itself. TASK-042 does both: verifies every parser against live VLR.gg markup, rewrites the parsers to match reality, builds the real (live) provider and discovery/backfill orchestration on top of TASK-041's foundation, and runs the approved historical backfill.

This document does **not** claim the production website consumes VLR-sourced data. Prediction Studio still uses synthetic VCT profiles, unchanged — see "Existing-product isolation" below.

---

## Approved scope

- **Date range:** completed matches from 2025-01-01 through the current date at execution time (`buildCanonicalTargetScope()`).
- **Included event families:** VCT Americas, VCT EMEA, VCT Pacific, VCT China, Masters, Champions.
- **Excluded:** Challengers/VCL and other tier-2 competitions, non-league qualifiers, Game Changers, showmatches, collegiate/community/third-party events, Ascension, scheduled/live/postponed/cancelled/forfeited-without-usable-data matches, events that cannot be classified confidently.
- **Live access statement:** permission to access and process VLR.gg data was obtained directly from VLR.gg. No private correspondence, names, emails, screenshots, or authorization tokens are present anywhere in this repository.

---

## Actual request policy used

Every live command (`smoke`, `discover`, `backfill`, `retry`) prints this before making any request. The live run described here used the repository defaults, unchanged:

```
VLR_NETWORK_ENABLED=true
concurrency: 1
minimum request interval: 2000ms
request timeout: 15000ms
max response bytes: 2,000,000
max retries: 2
raw HTML storage: false (never persisted)
```

---

## Real markup verification

Before any parser was trusted, a bounded live-inspection session fetched real pages into the gitignored `services/vlr-ingestion/.local/raw-inspect/` scratch directory (never committed, never containing anything beyond page structure needed for parser development):

- `https://www.vlr.gg/events` (and one paginated follow-up)
- `https://www.vlr.gg/event/2766/valorant-champions-2026` (Champions — international, no stage tag)
- `https://www.vlr.gg/event/2765/valorant-masters-london-2026` (Masters — stage tag literally "Masters")
- `https://www.vlr.gg/event/2977/vct-2026-americas-stage-2` (single-region VCT league stage)
- `https://www.vlr.gg/event/matches/2765`
- `https://www.vlr.gg/684613/xi-lai-gaming-vs-nrg-valorant-masters-london-2026-r1`
- `https://www.vlr.gg/team/13581/xi-lai-gaming`

### What TASK-041's synthetic fixtures got wrong

| Assumption | Reality |
|---|---|
| `.event-list` / `.event-list-item` roots | `.events-container` / `a.event-item` cards, no dedicated list wrapper |
| `.match-list` / `.match-list-item` roots | No wrapper at all — `.wf-label.mod-large` day headings followed by `a.match-item` cards |
| `.event-page` / `.match-page` roots | `.event-header` / `.match-header` — no such wrapper classes exist |
| `data-status` on event/match rows | Status is visible *text* (`.event-item-desc-item-status`, `.ml-status`), and match-detail pages carry **no status text of their own at all** |
| `data-team-id` on match-list rows | Real match-list rows expose only team **names** — team IDs exist only on the match-*detail* page, via `.match-header-link[href="/team/<id>/..."]` |
| `data-scheduled` ISO attribute | Real timestamps come from `data-utc-ts` on `.moment-tz-convert` nodes, in two different real forms (epoch seconds, and a space-separated `"YYYY-MM-DD HH:MM:SS"`) — never an attribute named `data-scheduled` |
| `event-header-series` / `-region` / `-stage` selectors | Real breadcrumb: `.event-header-main-bc > a` (parent series text) + `.event-header-main-bc-tags > a` (stage/region tags, e.g. `/vct/?stage=46` → "Masters") |
| Tier-2 events tagged `tier-2` | Real events are literally named "Challengers ..." / "VCL ..." — no explicit tag |
| Per-map scores as flat spans | Real per-map scores require joining `.vm-stats-gamesnav-item[data-game-id]` (order + name) against a separate `.vm-stats-game[data-game-id]` block (scores, attack/defense via `.mod-t`/`.mod-ct`, winner via a `.mod-win` class on the `.score` element) |

### Parser changes made

All five parsers (`eventDiscoveryParser`, `eventParser`, `matchListParser`, `matchDetailParser`, `teamParser`) were rewritten against the real structure above. `PARSER_VERSION` was bumped from `vlr-parsers@1.0.0` to `vlr-parsers@2.0.0` to mark this. Notable behavioral changes:

- `parseEventPage` now requires a `statusHint` (carried from the discovery-listing entry) instead of reading status text from the detail page, since none exists there.
- `parseMatchListPage` no longer requires (or can produce) a team ID — `VlrMatchSummary.teamAVlrTeamId`/`teamBVlrTeamId` became optional, with `teamANameRaw`/`teamBNameRaw` added.
- `parseMatchDetailPage` gained roster extraction (`rostersAtMatchTime`) from the aggregate "All Maps" stats table, and a `statusHint` parameter with a best-effort text-based fallback (`"final"` → completed) for when no hint is available.
- `classification/eventClassification.ts` gained: a Masters rule keyed on the breadcrumb stage tag; a Champions rule keyed on "no stage tag + title says Champions"; explicit "Challengers"/"VCL" tier-2 name patterns; and a guard that evaluates exclusion-by-name *before* the generic VCT-region structured-metadata rule, since a real tier-2 event can share the exact same `/vct` breadcrumb shape as an approved league stage. Two name-pattern-tier fallback rules were also tightened after live discovery surfaced false positives: a bare `\bchampions\b` match swept in unrelated events like "HUTECH Esports Championship" and "ESSL Champions Cup 2026" (fixed by requiring the phrase "valorant champions"), and a bare `\bmasters\b` match swept in third-party events like "FunPay Clutch Masters", "POP Esports Masters Season 6", and "Shanghai Esports Masters" — a different, unofficial event from the real "Champions Tour 2024: Masters Shanghai" (fixed by requiring the phrase "valorant masters", which every genuine Masters event this scope has seen is literally titled with).
- `normalize/mapNormalization.ts` added `"Corrode"` to the known map pool (added to competitive rotation within this dataset's 2025–2026 window).
- `normalize/dateNormalization.ts` gained `parseUtcTsAttribute` (handles both real `data-utc-ts` forms) and `parseEventDateRangeText` (parses `"Mon D – Mon D, YYYY"` / `"Mon D–D, YYYY"`, refusing the year-less discovery-listing form rather than guessing).

Every fixture in `services/vlr-ingestion/fixtures/` was rewritten to match this real structure (still synthetic content — no live page was ever committed); see `fixtures/fixtures.meta.json` for the live-verification note on each.

### Circuit breaker / parser-change detection

`RealVlrProvider` and the backfill runner surface every parse failure through the failure ledger (`errorCode: "parse_failure"`); `pnpm ingest:vlr:status` and `pnpm ingest:vlr:report` make a widespread failure rate immediately visible (`networkFailures`/`parseFailures` counts). A sustained spike in `parse_failure` entries for the same operation is the signal that VLR's markup has changed again and the affected parser needs re-verification — the ledger's per-entity attempt history is exactly the audit trail needed to see that pattern.

---

## Event discovery

`RealVlrProvider.discoverEvents`/`fetchEventListPage` (`services/vlr-ingestion/src/vlr/realVlrProvider.ts`) paginate `/events?page=N`. A listing entry is only fetched (its detail page) if its listed status is `completed` or `ongoing` — a purely `upcoming` event can never contain a completed match, so it's skipped without a request.

`discovery/eventManifest.ts#discoverEventsResumable` is the resumable orchestrator that actually drives the historical backfill (`buildEventDiscoveryManifest` is an older, non-resumable single-pass path still used by the fixture-based `IngestionService`). It:

- Binds its checkpoint to a **stable scope identity hash** (`scope/backfillScope.ts#serializeDiscoveryScopeIdentity`) — start date, event families, regions, and tournament levels, deliberately **excluding** end date (always "today," which would otherwise break resumability across days) — plus the current parser version, so a scope or parser change is detected and a full re-scan is forced rather than silently resuming with stale assumptions.
- Resumes from `lastCompletedPage` on every invocation and merges newly classified events into the existing manifest idempotently — an already-verified event is never re-fetched.
- Detects the archive boundary explicitly: 5 consecutive listing pages producing zero in-range candidate marks `archiveComplete: true` in the checkpoint. Completion is a discovery-checkpoint fact, never an artifact of a bounded `--max-pages` invocation stopping early.
- Supports `--restart-discovery` to force a full re-scan (used, for example, after a classification-rule change needs to be re-applied to already-discovered events).
- Gates `inclusionStatus` on **both** approved-family classification **and** the event's own date range actually overlapping the scope (`isEventWithinScope`) — an approved-family event entirely outside the scope's date window (e.g. a 2024 "Champions Tour 2024" stage) is explicitly `excluded` with `exclusionReason: "outside-date-scope"`, never included just because its family matched.

It persists the full manifest (`.local/vlr-data/discovery/events-manifest.json`) and a normalized event record for every **included** entry (`.local/vlr-data/normalized/event/`), so the backfill runner can resolve a match's parent event without re-fetching it.

## Event classification overrides

No override was needed for the events actually discovered — every approved-family event resolved correctly via structured breadcrumb metadata (see "Real markup verification" above), and every tier-2/qualifier/Game-Changers/community event resolved correctly via name pattern. `classification/eventOverrides.ts`'s `INITIAL_EVENT_CLASSIFICATION_OVERRIDES` registry remains empty; if a low-confidence or unknown event is found during a future run, add an entry there with a verified VLR event ID and a `reason` documenting the verification source, per the registry's existing validation.

## Match discovery

`discovery/matchManifest.ts#buildMatchDiscoveryManifestResumable` is the resumable orchestrator (`buildMatchDiscoveryManifest` is the older single-pass path, same relationship as the event-discovery pair above). Per **included** event, it follows `nextPageUrl` cursors (`provider.fetchMatchListPage`) until exhausted, verifies the discovered count against the event's own listed "Matches (N)" total before marking that event's checkpoint `verifiedComplete` (a count mismatch is recorded as an anomaly and the event is *not* marked complete — no event can be certified done while pages remain unaccounted for), and skips any event already `verifiedComplete` entirely (no re-fetch). A match ID that appears under more than one event listing is deduplicated (the first event wins); only `completed`-listed matches are marked `detailFetchStatus: "pending"`, anything else is `"skipped-non-completed"`.

On every run it also **prunes** any previously-merged entry whose parent event is no longer `included` in the current event manifest — necessary because a classification-rule fix (see "Parser changes made") can move an event from included to excluded between runs, and a stale match-manifest entry for a now-excluded event must never silently linger.

## Checkpoints

- **Event discovery:** `checkpoints/event-discovery/event-discovery.json` — `lastCompletedPage`, `discoveredEventIds`, `scopeHash` (bound to the stable scope identity, see "Event discovery" above), `parserVersion`, and `archiveComplete`. Resumed automatically on every `pnpm ingest:vlr:discover`; a scope or parser mismatch forces a fresh scan rather than silently resuming.
- **Match discovery:** one checkpoint per included event (`discoveredMatchIds`, `expectedMatchCount`, `verifiedComplete`) — `pnpm ingest:vlr:validate` hard-fails if any included event lacks a checkpoint or has `verifiedComplete: false`.
- **Match detail backfill:** implicit and store-based — a match already normalized with `status: "completed"` is never re-fetched (`ingestion/backfillRunner.ts`), so re-running `backfill` is always a correct resume, never a restart.
- **Failure ledger:** `.local/vlr-data/failures/ledger.json`, keyed by `(entityType, externalId, operation)`; attempt count and first/latest failure timestamps persist across retries; a circuit breaker trips after 4 consecutive parse failures.

---

## Commands

| Command | Network | Purpose |
|---|---|---|
| `pnpm ingest:vlr:smoke <event-id> <status-hint> <match-id>` | Yes (3 requests) | Smallest possible live check: one event page, one match-list page, one match-detail page. Persists nothing. |
| `pnpm ingest:vlr:discover [--max-pages N] [--restart-discovery]` | Yes | Resumable paginated event + match discovery; writes both manifests and prints the pre-backfill report. Resumes from the last checkpoint by default (`--max-pages` bounds a single invocation's page count, default 20, ceiling 400 — repeated invocations resume automatically until `archiveComplete: true`). `--restart-discovery` forces a full re-scan from page 1. |
| `pnpm ingest:vlr:backfill --batch-size 50` | Yes | Fetches up to 50 not-yet-completed matches from the match manifest, normalizes, persists. |
| `pnpm ingest:vlr:resume` | Yes | Identical to `backfill` — resuming *is* just running it again. |
| `pnpm ingest:vlr:retry` | Yes | Retries only matches with an unresolved, retryable failure in the ledger. |
| `pnpm ingest:vlr:report` | No | Data-quality report from the already-persisted store. |
| `pnpm ingest:vlr:validate` | No | Deterministic completeness checks; exits non-zero on any hard failure. |
| `pnpm ingest:vlr:manifest` | No | Builds and persists the dataset version manifest. |
| `pnpm ingest:vlr:status` | No | Read-only summary: manifest state, normalized/pending counts, unresolved failures, suggested next command. |

All commands invoke the root scripts without a manual `--` separator (e.g. `pnpm ingest:vlr:backfill --batch-size 50`, not `pnpm ingest:vlr:backfill -- --batch-size 50`) — the root `package.json` scripts forward extra arguments directly.

---

## Storage layout

Reused the existing `FilesystemIngestionStore` abstraction (TASK-041) rather than introducing a new one:

```
services/vlr-ingestion/.local/vlr-data/
  raw/                          # raw provider documents (if ever used)
  normalized/
    event/<internalId>.json
    match/<internalId>.json
    _index/unmapped-teams.json
    _index/unknown-events.json
  checkpoints/                  # per TASK-041's IngestionService (fixture pipeline)
  discovery/
    events-manifest.json
    matches-manifest.json
    dataset-manifest.json
  failures/
    ledger.json
```

Gitignored via `services/vlr-ingestion/.local/` (already in the repository's `.gitignore` since TASK-041). Raw HTML is never stored (`VLR_RAW_HTML_STORAGE=false`, unchanged default).

---

## Team identity resolution

`identity/teamMapping.ts`'s `INITIAL_TEAM_MAPPING_REGISTRY` — empty at TASK-041 — now has 10 verified exact-ID mappings, each captured directly from a live match page's `/team/<id>/<slug>` links (fetched 2026-07-18 during the smoke/verification session) and matched by exact display name against `@repo/prediction-engine`'s 32-team directory:

| VLR ID | Internal ID | Region |
|---|---|---|
| 1034 | nrg | americas |
| 120 | 100-thieves | americas |
| 2355 | kru-esports | americas |
| 1001 | team-heretics | emea |
| 2059 | team-vitality | emea |
| 397 | bbl-esports | emea |
| 624 | paper-rex | pacific |
| 918 | global-esports | pacific |
| 1119 | all-gamers | china |
| 13581 | xi-lai-gaming | china |

Teams seen on the same live pages that are **not** among the 32 supported teams (e.g. Karmine Corp, Team Secret, Asterisk, PCIFIC Esports, SwimTrek Blue, VARREL) were correctly left unmapped — never guessed by name. The remaining 22 supported teams, and every unsupported historical opponent, remain unmapped until their real ID is confirmed the same way (seeing their `/team/<id>/...` link on a fetched page) — see "Actual results" for the exact unmapped count from this run. Unmapped teams do not block ingestion; they persist as `vlr:team:<id>` and are reported via `listUnmappedTeams()`.

---

## Player and roster capture

`matchDetailParser.parseRosters` extracts the roster that actually played from the match's own aggregate stats table (never the team page's *current* roster, which would misrepresent history) as VLR player IDs, split into two 5-player groups by document order. `normalizeMatch` converts these into `NormalizedRosterSnapshot`s (deterministic `vlr:player:<id>` internal IDs) and flags `incomplete_roster` when a completed match's roster snapshot is missing or short of 5 players per team. No player-level model features are computed.

---

## Timestamp handling

- **Match detail:** `data-utc-ts` on `.moment-tz-convert` — the only unambiguous source anywhere in the real markup, trusted directly (the attribute name is the source's own UTC assertion), normalized via `parseUtcTsAttribute`.
- **Event detail:** the `"Dates"` meta value (e.g. `"Sep 24 – Oct 18, 2026"`) is year-bearing and normalized via `parseEventDateRangeText`.
- **Discovery listings:** both the events index (`"Jul 17—Sep 7"`, no year) and the match list (`"Sat, June 6, 2026" + "9:00 PM"`, no explicit offset) are genuinely ambiguous and are **never** promoted past `raw` text at that stage — only the corresponding detail-page fetch produces a normalized, high-confidence timestamp.

---

## Match status handling

Real match-list pages expose status as text (`"Completed"`/`"LIVE"`/etc. mapped via `STATUS_TEXT_LOOKUP`); real match-detail pages expose **no** status text of their own, so the list-derived status is threaded through as `statusHint` at every detail fetch (`VlrIngestionProvider.getMatch`'s new `statusHint` option, `ingestionService.ts`'s `processMatch`, `backfillRunner.ts`). A postponed/cancelled match is recorded, flagged, and excluded from training by default (`evaluateTrainingEligibility`) — never silently promoted to completed.

---

## Data-quality report and completeness validation

`pnpm ingest:vlr:report` (`discovery/qualityReport.ts`) and `pnpm ingest:vlr:validate` (`discovery/completenessValidation.ts`) both read only the already-persisted store and manifests — no network access. `validate` fails hard on: event discovery not confirmed `archiveComplete` back through the scope start date, a zero-event approved family, an included event with no match-discovery checkpoint or one not `verifiedComplete` (incomplete pagination), a discovered completed match with neither a normalized record nor a recorded failure, a duplicate normalized match ID, a record missing provider source identity, a training-eligible match with no winner or zero played maps, a training-eligible match scheduled before/after the scope's date window or not actually completed, and an included event with an out-of-scope classification. Everything softer (incomplete roster, unknown patch) is a warning.

---

## Dataset manifest

`discovery/datasetManifest.ts` builds a deterministic dataset version — a SHA-256 hash (truncated to 16 hex characters) of the scope, schema version, parser version, and the sorted list of every normalized match's external ID — **never** a random UUID. Re-running the identical backfill against identical discovered content always reproduces the same `datasetVersion`.

---

## Actual results

From the live run completed 2026-07-18, with **full resumable archive discovery reaching the approved scope's 2025-01-01 start date** (`archiveDiscoveryComplete: true`, `lastCompletedDiscoveryPage: 20`, verified by 5 consecutive listing pages producing zero in-range candidate):

- 665 candidate events scanned across the full archive back to 2025-01-01; **16 included**, all six approved families represented: vct-americas: 3, vct-emea: 3, vct-pacific: 3, vct-china: 2, masters: 4, champions: 1 (Valorant Champions 2025). 14 excluded (approved-family events entirely outside the 2025–2026 date window, e.g. "Champions Tour 2024" stages). 635 unknown (community/collegiate/third-party events correctly outside scope).
- The full included-event list: `services/vlr-ingestion/.local/vlr-data/discovery/events-manifest.json` — 16 entries with `inclusionStatus: "included"`, spanning VCT 2026 Kickoff/Stage 1/Stage 2 (all four regions), Valorant Masters Bangkok 2025, Toronto 2025, London 2026, Santiago 2026, and Valorant Champions 2025.
- 508 unique match links discovered (445 duplicates, from events sharing listed opponents across stages); 434 completed, 74 non-completed.
- 434/434 completed matches successfully fetched, normalized, and verified against each event's own listed match-discovery checkpoint (0 unresolved failure-ledger entries; 1 historical network failure — a response exceeding the default 2MB cap on the Champions 2025 Grand Final — resolved by retrying with a raised `VLR_MAX_RESPONSE_BYTES`).
- 432/434 (99.5%) training-eligible; 2 non-eligible (forfeits).
- By year: 2025: 76, 2026: 358. By family: vct-americas: 76, vct-pacific: 78, vct-emea: 78, masters: 90, vct-china: 78, champions: 34.
- 43 unique unmapped teams; the 10 pre-verified mappings (see "Team identity resolution") account for the rest.
- `pnpm ingest:vlr:validate` passes with 0 failures and 3 warnings (incomplete roster snapshots on 3 matches — informational, not a completeness failure).
- Two real classification bugs were found and fixed during this live run (not from synthetic fixtures) — see "Parser changes made": an unqualified `\bchampions\b` name-pattern match, and an unqualified `\bmasters\b` name-pattern match, each swept in unrelated third-party events before being tightened to require the full official phrase.
- Deterministic repository verification: `pnpm lint`, `pnpm check-types`, `pnpm test` (447 web + 324 vlr-ingestion tests), and `pnpm build` all pass. `pnpm test:e2e -- --workers=1` passed 79/79 in 3 of 4 full-suite runs during this session; the one run with sporadic accessibility-check failures (4 tests, all unrelated to this session's `vlr-ingestion`-only changes) was investigated per TASK-042's explicit instruction rather than dismissed — all 4 failing tests and their containing spec files were re-run in isolation, twice each (12 isolated runs total), and passed 12/12, confirming this is the same long-single-worker-run flakiness already root-caused and documented earlier in this task, not a regression.

See the TASK-042 final report (delivered in-conversation, not duplicated here) for the complete breakdown by map/series-format/team and every verification step's result.

---

## Privacy

No private permission correspondence, personal contact details, screenshots, or authorization tokens are present anywhere in this package, its fixtures, its `.local/` scratch data, or this document. Player data captured is limited to what VLR.gg publicly displays for esports identification (handle, VLR player ID, team association at match time) — no social-media or unrelated personal-data enrichment.

---

## Known limitations

- Match-list pagination is implemented (`fetchMatchListPage` follows `nextPageUrl` cursors), but no event encountered during the full 2025-01-01-to-current archive scan actually required a second page — VLR lists every match for the event families and date range in scope on one page. The multi-page path is exercised by mocked tests (`matchManifestResumable.test.ts`) rather than a real multi-page event, since none exists in the approved scope as scanned.
- Roster grouping (`parseRosters`) splits the aggregate stats table's player rows into two even halves by document order. This matches every match inspected during this task (VLR consistently lists team A's five rows before team B's) but is not verified against a match with an uneven substitution mid-map.
- Team mapping covers 10 of the 32 supported teams, verified from the pages fetched during this task's smoke/verification session — not all 32. Remaining teams are discovered and reported as unmapped as their matches are backfilled; add verified entries to `identity/teamMapping.ts` the same way (an exact `/team/<id>/<slug>` link seen on a fetched page).
- No production database — filesystem storage only, per TASK-042's explicit instruction not to introduce one unless proven incapable of completing the backfill (it was not proven incapable).
- No scheduled/production ingestion job exists.
- No model training, no model inference, no frontend integration — Prediction Studio is unchanged.
- **Operational note:** a background live-discovery process spawned early in this task's session was not fully terminated by a stop request issued against it, and continued running unsupervised for a period before being force-killed directly by process ID. It made no more than the configured rate of requests at any point (the same `VlrHttpClient` rate limiter governed it throughout) and corrupted no normalized match data (those are looked up and written by content, not overwritten wholesale), but it did overwrite the discovery manifest with results computed under a now-fixed classification bug. The manifest was regenerated cleanly afterward and cross-checked against the already-backfilled dataset. Anyone extending this backfill in a similar background/detached fashion should verify actual process termination (e.g. via a process listing) rather than trusting a stop signal alone.
- **e2e determinism:** the 79-test Playwright suite passes 79/79 at `--workers=1` reliably, but a long single-worker run occasionally shows sporadic, non-reproducing failures (seen this session as 4 accessibility-check failures in one of four full-suite runs; seen in an earlier session as a `router.replace()` timing race, since fixed). Every test implicated so far has passed 100% of the time when re-run in isolation or as its containing spec file alone, pointing to accumulated overhead in a long single-worker run rather than a product or test defect. If a future run surfaces a *new*, consistently-reproducing failure (i.e. one that also fails in isolation), treat that as a real regression, not this same flakiness.

## Next step

TASK-043: identity-resolution and data-quality hardening — extending the team mapping registry toward full 32-team coverage, verifying event-family coverage across additional historical seasons if the scope is ever extended backward, and any data-quality remediation the completeness/quality reports surface as worth addressing before model feature work begins.
