# VLR Data Ingestion Foundation

Version: 1.0 (TASK-041)

Status: Foundation only — no historical backfill has been run

---

## Purpose

This document defines the ingestion foundation that TASK-042's historical backfill will build on: provider interfaces, a VLR HTTP client with conservative safety controls, HTML parsing, raw/normalized schemas, deterministic identity, event classification, training-eligibility rules, a filesystem persistence layer, and CLI commands — all fixture-testable without any network access.

It does **not** perform the historical backfill itself, train a model, or change what the production Prediction Studio serves. See "Known limitations" below.

---

## Permission and attribution

> Permission to access and process VLR.gg data was obtained directly from VLR.gg. This repository does not include private correspondence or personal contact details. Data access must remain within the approved scope and configured request limits.

This repository does not claim any broader permission than stated above. No email addresses, screenshots, names, or authorization tokens related to that permission are committed anywhere in this codebase.

Every fetched record's `metadata.sourceUrl` traces back to the exact VLR.gg page it came from. VLR-provided data is not owned by this project; it is used only within the approved scope and the request limits documented below.

---

## Approved target dataset (for TASK-042)

- **Date range:** completed matches from **2025-01-01** through the current date at execution time (the end date is computed at call time, never hard-coded, so extending the range never requires redesigning the scope model — see `scope/backfillScope.ts`).
- **Included event families:** VCT Americas, VCT EMEA, VCT Pacific, VCT China, Masters, Champions.
- **Excluded categories:** tier-2 events, non-league qualifiers, Game Changers, showmatches, and unrelated/unclassifiable events.
- **Completed matches only** — scheduled and live matches are modeled (for future use) but never training-eligible.

---

## Historical scope model

`scope/backfillScope.ts` defines a provider-neutral `BackfillScope`: `startDate`, `endDate`, `matchStatus`, `eventFamilies`, `regions`, `tournamentLevels`, `completedOnly`, `includeEventIds`, `excludeEventIds`, `maximumEvents`, `maximumMatches`, `resumeCheckpoint`.

- `validateBackfillScope` never invents or repairs an invalid scope — it reports every violation.
- `serializeBackfillScope` produces a deterministic string (sorted array fields, fixed key order) used as the checkpoint key.
- `buildCanonicalTargetScope(asOfDate?)` builds exactly the approved dataset above; `asOfDate` defaults to `new Date()`, so the canonical scope always ends "today" without code changes.
- `maximumEvents`/`maximumMatches` are bounded (ceilings of 2,000 / 50,000) — no scope can request an unbounded crawl.

**Automatic discovery, not manual IDs:** nothing in this scope model or the coordinator that consumes it accepts a hand-maintained list of match IDs. Events and matches are always discovered from provider listing pages.

---

## Event discovery and classification

`classification/eventClassification.ts` classifies a discovered event into one of:

- **Approved:** `vct-americas`, `vct-emea`, `vct-pacific`, `vct-china`, `masters`, `champions`
- **Excluded:** `excluded-tier-2`, `excluded-qualifier`, `excluded-game-changers`, `excluded-showmatch`, `excluded-unrelated`
- **`unknown`** — insufficient evidence; never enters the approved dataset

Evidence is consulted in strict priority order:

1. **Override registry** (`classification/eventOverrides.ts`) — authoritative. Keyed by VLR event ID; conflicting entries for the same ID fail validation. Starts empty (see "Mapping policy" below).
2. **Structured metadata** — tags, parent series, region — confidence `"high"`.
3. **Event name pattern** — confidence `"low"`, reason string explicitly says "provisional — name-only match." Diagnostic, never silently authoritative.
4. **Unknown** — confidence `"low"`, evidence `"insufficient-evidence"`.

TASK-041 does not run a full event discovery crawl — classification is unit-tested against fixtures for all six approved families and all five excluded categories, plus an explicit unknown-event fixture.

---

## Provider architecture

`provider/types.ts` defines `EsportsDataProvider` — the provider-*neutral* contract (`ProviderTeam`, `ProviderEvent`, `ProviderMatchSummary`, `ProviderMatchDetail`, `ProviderMapResult`, pagination via `ProviderPage`/`ProviderSyncCursor`, etc.) that any future non-VLR provider would implement.

**A documented architectural decision:** the TASK-041 ingestion coordinator (`ingestion/ingestionService.ts`) does not consume `EsportsDataProvider` directly. It consumes a narrower `VlrIngestionProvider` (`ingestion/vlrIngestionProvider.ts`) typed against VLR's own raw schemas (`VlrEvent`, `VlrMatchSummary`, `VlrMatchDetail`). VLR is the only provider implemented today; introducing a `Provider* ⇄ raw` conversion layer with no second consumer would be premature abstraction (CLAUDE.md Rule 6 — prefer the simpler solution). A future second provider adds that conversion — and a shared coordinator over `EsportsDataProvider` — at the point it is actually needed. `EsportsDataProvider` remains the documented target contract for that future work.

---

## HTTP client and request policy

`vlr/httpClient.ts` (`VlrHttpClient`) is Node-only and never imported by client-rendered code.

| Control | Behavior |
|---|---|
| Network kill switch | Refuses every request unless `VLR_NETWORK_ENABLED=true` |
| Concurrency | 1–4, default 1 |
| Minimum request interval | 2,000ms–300,000ms, default 2,000ms |
| Timeout | 1,000ms–60,000ms, default 15,000ms |
| Max response size | 100KB–10MB, default 2MB, enforced via both `Content-Length` and a streamed byte count |
| Max retries | 0–5, default 2, only for retryable statuses (408/425/429/500/502/503/504) and network errors |
| Backoff | Exponential with jitter, or `Retry-After` when present |
| Redirects | Followed manually up to 3 hops, each hop re-validated against the approved host |
| Content-type | Must be `text/html` |
| Cancellation | `AbortSignal` respected at every await point |
| Credentials | No cookies, no forwarded auth headers |

All bounds are clamped in `env.ts` regardless of configured environment values, so misconfiguration cannot produce an aggressive crawl.

### URL safety (SSRF)

`vlr/urlBuilder.ts` builds every request URL from a validated ID and a fixed path template — never from an arbitrary caller-supplied URL. `assertApprovedUrl` (applied to both outgoing requests and every redirect hop) rejects: non-`https`, embedded credentials, non-default ports, and any hostname other than the exact approved host — which by construction rejects localhost, loopback IPs, IPv6 loopback, private-network IPs, `file:`/`data:`/`javascript:` URLs, alternate domains, and deceptive lookalike subdomains.

---

## HTML parsing

Parsers live under `vlr/parsers/` — one per page type (team, event, event-discovery, match-list, match-detail), each a pure function (`html`, source metadata) → `ParseOutcome`. `jsdom` (already a workspace dependency, used today by `apps/web`'s component tests) provides real `querySelector`/`textContent` semantics — safe entity decoding and whitespace-resilient text extraction, instead of hand-rolled regex.

Every parser:

- Uses a primary selector plus a documented fallback (e.g. team/event/match ID from the source URL, falling back to a `data-*-id` attribute), emitting a `parser_fallback_used` warning when the fallback fires.
- Distinguishes **fatal** (`errors` non-empty, `value: null` — an identity-critical field is missing) from **warning** (optional field missing, or a fallback was used).
- Never fabricates a score, date, team, winner, or classification.
- Carries a `parserVersion` string on every output.

| Parser | Required fields | Optional fields | Fixture coverage |
|---|---|---|---|
| Team | ID, name | short name, region, logo, roster | happy path, missing name (fatal), fallback ID |
| Event | ID, name, status | dates, region, series, season, stage, tags | one fixture per approved family, per excluded category, and unknown |
| Event discovery | — (list) | — | listing with a deliberate duplicate |
| Match list | ID, both teams, status | round text, series format | listing with a deliberate duplicate |
| Match detail | ID, both teams, status | winner, series format, patch, maps, splits | completed, scheduled, postponed, missing-optional-fields, malformed (fatal) |

---

## Raw vs. normalized data

**Raw** (`vlr/schemas/raw.ts`): `VlrTeam`, `VlrPlayer`, `VlrEvent`, `VlrMatchSummary`, `VlrMatchDetail`, `VlrMapResult` — the closest representation of what a page parse observed, per docs/06-data-architecture.md's "Layer 1 — Raw Storage." `null` map scores mean "not played," distinct from a genuine 0–0.

**Normalized** (`normalize/normalizedSchemas.ts`): `NormalizedTeam`, `NormalizedEvent`, `NormalizedMatch`, `NormalizedMapResult`, etc. Every normalized record carries `IngestionRecordMetadata` (provider, external ID, source URL, `fetchedAt`, `parsedAt`, schema version, content hash) and is produced by a pure `normalizeTeam`/`normalizeEvent`/`normalizeMatch` function — same input always produces the same output (idempotent).

Date/timezone handling (`normalize/dateNormalization.ts`) only promotes a timestamp to a normalized ISO value when the source is unambiguous (an explicit `Z`/offset); a bare display string is kept as `raw` with `confidence: "none"` rather than guessing a timezone. Map names (`normalize/mapNormalization.ts`) and series format (`normalize/seriesFormat.ts`) are normalized with a small alias table; an unrecognized value is preserved verbatim, never remapped to something else.

---

## Training-eligibility policy

`normalize/trainingEligibility.ts` is a pure function. A match is eligible only when: status is `completed`; `playedAt` is normalized (not ambiguous) and falls within `[scopeStartDate, scopeEndDate]`; the event classification is one of the six approved families; both teams are identified; the winner is known; the series result is internally consistent for its format; at least one map was played; and the record is not cancelled, postponed, a showmatch, or a duplicate. Ineligible records are never deleted — eligibility is a label, and every failing rule is reported by name.

---

## Identity and mapping policy

Provider source identity: **`vlr:<entity-type>:<external-id>`** (`identity/deterministicId.ts`). This string is also the internal ID for any entity with no verified platform mapping — no random UUID is used or needed.

**Team mapping** (`identity/teamMapping.ts`): maps a VLR team ID to one of the 32 existing `VctTeamId`s from `@repo/prediction-engine` — reused, not duplicated a third time. Exact-ID mapping is authoritative; display-name aliases exist only for human diagnostics (`findAliasCandidates`) and can never silently create a mapping. An unmapped team still normalizes to a valid external identity; it is reported via `listUnmappedTeams`, never dropped.

**Event classification overrides** (`classification/eventOverrides.ts`): keyed by VLR event ID, validated for conflicts.

Both registries start **empty** — TASK-041 does not invent VLR team or event IDs, and no verified ID was available from an approved source at foundation time (fixtures are synthetic, not real VLR captures, so they cannot seed a "verified" mapping). The registry structure, validation, and lookup are fully built and tested; TASK-042 populates entries as real, verified IDs are confirmed.

---

## Persistence

No database exists yet in this repository (the current production system holds synthetic data in-memory inside `@repo/prediction-engine`). `persistence/filesystemStore.ts` (`FilesystemIngestionStore`) is the initial durable store, implementing `RawRecordStore`, `NormalizedRecordStore`, `IngestionCheckpointStore`, and `DiscoveryIndexStore`.

- Every write is atomic (temp file + rename).
- Every path is built through `persistence/pathSafety.ts`, which rejects traversal and constrains filenames.
- `upsertNormalizedEntity` compares `metadata.contentHash` (not the full serialized record), so re-ingesting unchanged source content is a true no-op even though `fetchedAt`/`parsedAt` differ between runs.
- Raw HTML is **not** stored by default (`VLR_RAW_HTML_STORAGE=false`); nothing in this foundation persists a full page archive.
- The store root (`VLR_DATA_DIR`, default `.local/vlr-data`) is gitignored.

Content hashing (`normalize/contentHash.ts`) is a stable, sorted-key SHA-256 over substantive content only, excluding the `source` metadata block (URL/fetch time), so identical content always hashes identically regardless of when it was fetched.

---

## Ingestion orchestration

`ingestion/ingestionService.ts` (`IngestionService.run(scope, options)`): validates the scope, discovers events, classifies and filters them, discovers matches per included event (deduplicating repeated match links so a match is fetched and normalized at most once per run), fetches and normalizes match detail, evaluates training eligibility, persists (unless `dryRun`), and writes a checkpoint only if the run completed without a failure. Every stage's failure is isolated and recorded in the run summary rather than aborting the whole run; cancellation (`AbortSignal`) never leaves a partially-written record behind, and never advances the checkpoint.

The run summary reports: discovered/included/excluded events (by reason), unknown events, discovered/duplicate match links, fetched/skipped-unchanged/completed/non-completed matches, parsed/normalized/inserted/updated/unchanged records, training-eligible matches (and ineligible-by-reason counts), warnings, failures, unmapped teams, duration, and checkpoint status.

---

## Commands

| Command | Network | Persists | Purpose |
|---|---|---|---|
| `pnpm ingest:vlr:fixtures` | Never | Yes (local fixture-run store) | Runs the full pipeline against synthetic fixtures |
| `pnpm ingest:vlr:scope:dry-run` | Never | No | Prints the canonical scope and the active rate/safety policy |
| `pnpm ingest:vlr:match -- <id> [event-id]` | Only if `VLR_NETWORK_ENABLED=true` | No | Fetches and parses one match page |
| `pnpm ingest:vlr:event -- <id>` | Only if `VLR_NETWORK_ENABLED=true` | No | Fetches, parses, and classifies one event page |

Every live command prints the active rate/concurrency policy before making a request, validates its ID argument against the approved-host URL builder, and exits non-zero on a fatal failure. No command accepts an arbitrary destination URL, and none crawls an unbounded number of pages.

---

## Environment variables

See `services/vlr-ingestion/.env.example`. All numeric values are clamped to a safe range in `env.ts` regardless of what is configured:

```
VLR_NETWORK_ENABLED=false
VLR_BASE_URL=https://www.vlr.gg
VLR_MIN_REQUEST_INTERVAL_MS=2000
VLR_MAX_CONCURRENCY=1
VLR_REQUEST_TIMEOUT_MS=15000
VLR_MAX_RESPONSE_BYTES=2000000
VLR_MAX_RETRIES=2
VLR_RAW_HTML_STORAGE=false
VLR_DATA_DIR=.local/vlr-data
VLR_BACKFILL_START_DATE=2025-01-01
```

---

## Network kill switch

`VLR_NETWORK_ENABLED` defaults to `false`. Importing any module in this package performs no network access — `VlrHttpClient` only makes a request when its `fetchHtml` method is called, and that method throws `network_disabled` unless the switch is explicitly `true`. `pnpm test`, `pnpm build`, and `pnpm dev` never enable it. The production web app never imports this package.

---

## Fixture testing

`fixtures/` contains synthetic, hand-authored HTML (see `fixtures/fixtures.meta.json` for purpose/capture-date/synthetic-flag metadata per file) — none are real VLR.gg captures. They cover: team page, event page (one per approved family and excluded category, plus unknown), event discovery/listing, match list, completed/scheduled/postponed match, a match with missing optional fields, and a deliberately malformed match page. `pnpm test` (via `pnpm --filter @repo/vlr-ingestion test`) exercises all of them; none requires network access.

---

## Data-quality flags

`normalize/qualityFlags.ts` defines a fixed vocabulary (`missing_team_mapping`, `ambiguous_timezone`, `unknown_map`, `inconsistent_winner`, `unknown_event_classification`, `not_training_eligible`, etc.), each with a severity, message, and optional field/source reference. Flags document a record's caveats; they never delete it.

---

## Privacy

No private permission correspondence, personal contact details, screenshots, or authorization tokens are present anywhere in this package, its fixtures, or its documentation.

---

## Known limitations

- No historical backfill has been run — TASK-042's job.
- No scheduled/production ingestion job exists.
- The production frontend does not consume any VLR-sourced data; Prediction Studio still uses synthetic VCT profiles, unchanged.
- No real-data prediction model exists.
- Team-mapping and event-override registries are structurally complete but intentionally empty — no verified real VLR ID was available at foundation time.
- `EsportsDataProvider` (the provider-neutral contract) has no second implementation yet; only the VLR-typed coordinator is exercised.
- Parsers assume the markup contract documented in `fixtures/fixtures.meta.json`; real VLR markup has not been captured or diffed against these fixtures, since no live request was made during this task (see the final report for whether one was made during verification).

---

## Next step

TASK-042: historical backfill of completed matches from 2025-01-01 onward across VCT Americas, EMEA, Pacific, China, Masters, and Champions, using the scope, classification, identity, normalization, persistence, and orchestration built here — extended with real event/match discovery pagination and verified team/event mapping entries.
