import { describeConfig, loadVlrIngestionConfig } from "../env";
import { IngestionError } from "../errors";
import { requireArg, runCli } from "./cliSupport";
import { VlrHttpClient } from "../vlr/httpClient";
import { buildEventMatchesUrl, buildEventUrl, buildMatchUrl, isValidVlrId } from "../vlr/urlBuilder";
import { parseEventPage } from "../vlr/parsers/eventParser";
import { parseMatchListPage } from "../vlr/parsers/matchListParser";
import { parseMatchDetailPage } from "../vlr/parsers/matchDetailParser";
import { classifyEvent } from "../classification/eventClassification";

/**
 * `pnpm ingest:vlr:smoke -- <event-id> <status-hint> <match-id>` — TASK-042
 * requirement 2/25A. The smallest possible live check: one event page, one
 * event match-list page, one match-detail page — exactly 3 requests,
 * printed and never persisted. Requires `VLR_NETWORK_ENABLED=true`.
 */
async function main(): Promise<void> {
  const eventId = requireArg(process.argv, 2, "event-id");
  const statusHintRaw = requireArg(process.argv, 3, "status-hint (upcoming|ongoing|completed)");
  const matchId = requireArg(process.argv, 4, "match-id");

  if (!isValidVlrId(eventId)) throw new IngestionError("invalid_provider_id", `"${eventId}" is not a valid VLR event ID.`);
  if (!isValidVlrId(matchId)) throw new IngestionError("invalid_provider_id", `"${matchId}" is not a valid VLR match ID.`);
  if (!["upcoming", "ongoing", "completed"].includes(statusHintRaw)) {
    throw new IngestionError("invalid_provider_id", `"${statusHintRaw}" is not a valid event status hint.`);
  }
  const statusHint = statusHintRaw as "upcoming" | "ongoing" | "completed";

  const config = loadVlrIngestionConfig();
  console.log("Rate/concurrency policy for this smoke run (3 requests total):");
  console.log(describeConfig(config));
  console.log("");

  if (!config.networkEnabled) {
    throw new IngestionError("network_disabled", "Set VLR_NETWORK_ENABLED=true to run a live smoke check.");
  }

  const client = new VlrHttpClient(config);
  let requestCount = 0;

  console.log(`[1/3] Fetching event page ${eventId} ...`);
  const eventUrl = buildEventUrl(config.baseUrl, config.approvedHost, eventId);
  const eventResponse = await client.fetchHtml(eventUrl);
  requestCount += 1;
  const eventResult = parseEventPage(eventResponse.html, { sourceUrl: eventResponse.finalUrl, fetchedAt: new Date().toISOString(), statusHint });
  console.log(`  errors: ${eventResult.errors.length}, warnings: ${eventResult.warnings.length}`);
  if (eventResult.value) {
    const classification = classifyEvent({
      providerEventId: eventResult.value.vlrEventId,
      name: eventResult.value.name,
      parentSeries: eventResult.value.parentSeries,
      region: eventResult.value.region,
      season: eventResult.value.season,
      stage: eventResult.value.stage,
      tags: eventResult.value.rawCategoryLabels,
    });
    console.log(`  name: ${eventResult.value.name}`);
    console.log(`  classification: ${classification.classification} (confidence: ${classification.confidence})`);
  } else {
    console.log(`  PARSE FAILED: ${JSON.stringify(eventResult.errors)}`);
  }

  console.log(`[2/3] Fetching event match-list for ${eventId} ...`);
  const matchesUrl = buildEventMatchesUrl(config.baseUrl, config.approvedHost, eventId);
  const matchesResponse = await client.fetchHtml(matchesUrl);
  requestCount += 1;
  const matchListResult = parseMatchListPage(matchesResponse.html, { sourceUrl: matchesResponse.finalUrl, fetchedAt: new Date().toISOString(), vlrEventId: eventId });
  console.log(`  errors: ${matchListResult.errors.length}, warnings: ${matchListResult.warnings.length}, matches found: ${matchListResult.value?.length ?? 0}`);

  console.log(`[3/3] Fetching match detail ${matchId} ...`);
  const matchUrl = buildMatchUrl(config.baseUrl, config.approvedHost, matchId);
  const matchResponse = await client.fetchHtml(matchUrl);
  requestCount += 1;
  const matchDetailResult = parseMatchDetailPage(matchResponse.html, { sourceUrl: matchResponse.finalUrl, fetchedAt: new Date().toISOString(), vlrEventId: eventId });
  console.log(`  errors: ${matchDetailResult.errors.length}, warnings: ${matchDetailResult.warnings.length}`);
  if (matchDetailResult.value) {
    console.log(`  teams: ${matchDetailResult.value.teamAVlrTeamId} vs ${matchDetailResult.value.teamBVlrTeamId}`);
    console.log(`  status: ${matchDetailResult.value.status}, winner: ${matchDetailResult.value.winnerVlrTeamId ?? "(none)"}`);
    console.log(`  maps: ${matchDetailResult.value.maps.length}, rosters captured: ${matchDetailResult.value.rostersAtMatchTime ? "yes" : "no"}`);
  } else {
    console.log(`  PARSE FAILED: ${JSON.stringify(matchDetailResult.errors)}`);
  }

  console.log("");
  console.log(`Smoke check complete. Live requests made: ${requestCount}. Nothing was persisted.`);

  const anyFatal = eventResult.errors.length > 0 || matchListResult.errors.length > 0 || matchDetailResult.errors.length > 0;
  if (anyFatal) process.exitCode = 1;
}

void runCli(main);
