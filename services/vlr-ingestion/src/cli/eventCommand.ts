import { describeConfig, loadVlrIngestionConfig } from "../env";
import { IngestionError } from "../errors";
import { VlrHttpClient } from "../vlr/httpClient";
import { buildEventUrl, isValidVlrId } from "../vlr/urlBuilder";
import { parseEventPage } from "../vlr/parsers/eventParser";
import { classifyEvent } from "../classification/eventClassification";
import { requireArg, runCli } from "./cliSupport";

/**
 * `pnpm ingest:event -- <event-id>` — see
 * docs/29-vlr-data-ingestion-foundation.md ("Commands") and TASK-041
 * requirement 23. A single, narrowly-scoped fetch: one event page, parsed
 * and classified, printed. Requires `VLR_NETWORK_ENABLED=true`; persists
 * nothing.
 */
async function main(): Promise<void> {
  const eventId = requireArg(process.argv, 2, "event-id");

  if (!isValidVlrId(eventId)) {
    throw new IngestionError("invalid_provider_id", `"${eventId}" is not a valid VLR event ID.`);
  }

  const config = loadVlrIngestionConfig();
  console.log("Rate/concurrency policy for this request:");
  console.log(describeConfig(config));
  console.log("");

  if (!config.networkEnabled) {
    throw new IngestionError("network_disabled", "Set VLR_NETWORK_ENABLED=true to run a live event fetch.");
  }

  const url = buildEventUrl(config.baseUrl, config.approvedHost, eventId);
  const client = new VlrHttpClient(config);
  console.log(`Fetching ${url.toString()} ...`);
  const response = await client.fetchHtml(url);

  const result = parseEventPage(response.html, { sourceUrl: response.finalUrl, fetchedAt: new Date().toISOString() });
  const classification = result.value
    ? classifyEvent({
        providerEventId: result.value.vlrEventId,
        name: result.value.name,
        parentSeries: result.value.parentSeries,
        region: result.value.region,
        season: result.value.season,
        stage: result.value.stage,
        tags: result.value.rawCategoryLabels,
      })
    : null;

  console.log(JSON.stringify({ value: result.value, classification, warnings: result.warnings, errors: result.errors }, null, 2));

  if (result.errors.length > 0) process.exitCode = 1;
}

void runCli(main);
