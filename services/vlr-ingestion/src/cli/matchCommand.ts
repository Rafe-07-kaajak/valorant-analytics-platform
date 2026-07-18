import { describeConfig, loadVlrIngestionConfig } from "../env";
import { IngestionError } from "../errors";
import { VlrHttpClient } from "../vlr/httpClient";
import { buildMatchUrl, isValidVlrId } from "../vlr/urlBuilder";
import { parseMatchDetailPage } from "../vlr/parsers/matchDetailParser";
import { requireArg, runCli } from "./cliSupport";

/**
 * `pnpm ingest:match -- <match-id> [event-id]` — see
 * docs/29-vlr-data-ingestion-foundation.md ("Commands") and TASK-041
 * requirement 23. A single, narrowly-scoped fetch: one match page, parsed,
 * printed. Requires `VLR_NETWORK_ENABLED=true`; prints the active rate
 * policy before making any request; persists nothing.
 */
async function main(): Promise<void> {
  const matchId = requireArg(process.argv, 2, "match-id");
  const eventId = process.argv[3]?.trim() || "unknown";

  if (!isValidVlrId(matchId)) {
    throw new IngestionError("invalid_provider_id", `"${matchId}" is not a valid VLR match ID.`);
  }

  const config = loadVlrIngestionConfig();
  console.log("Rate/concurrency policy for this request:");
  console.log(describeConfig(config));
  console.log("");

  if (!config.networkEnabled) {
    throw new IngestionError("network_disabled", "Set VLR_NETWORK_ENABLED=true to run a live match fetch.");
  }

  const url = buildMatchUrl(config.baseUrl, config.approvedHost, matchId);
  const client = new VlrHttpClient(config);
  console.log(`Fetching ${url.toString()} ...`);
  const response = await client.fetchHtml(url);

  const result = parseMatchDetailPage(response.html, { sourceUrl: response.finalUrl, fetchedAt: new Date().toISOString(), vlrEventId: eventId });
  console.log(JSON.stringify({ value: result.value, warnings: result.warnings, errors: result.errors }, null, 2));

  if (result.errors.length > 0) process.exitCode = 1;
}

void runCli(main);
