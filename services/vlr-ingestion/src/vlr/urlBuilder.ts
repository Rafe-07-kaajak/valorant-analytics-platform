import { IngestionError } from "../errors";

/**
 * SSRF-safe VLR URL construction — see
 * docs/29-vlr-data-ingestion-foundation.md ("Security") and TASK-041
 * requirement 24. Every URL the ingestion service ever fetches is built
 * here from a validated ID and a fixed path template. Nothing in this
 * module accepts an arbitrary caller-supplied destination URL.
 */

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function isValidVlrId(id: string): boolean {
  return ID_PATTERN.test(id);
}

function assertValidId(id: string, label: string): void {
  if (!isValidVlrId(id)) {
    throw new IngestionError("invalid_provider_id", `${label} "${id}" is not a valid VLR ID (expected 1-64 alphanumeric/-/_ characters).`);
  }
}

/**
 * Validates that a URL is safe to fetch: HTTPS, the approved host exactly
 * (no subdomain tricks, no deceptive lookalikes), no embedded credentials,
 * and no non-default port. Applied both when building request URLs and
 * when validating a redirect `Location` target, so a redirect can never
 * escape the approved host.
 */
export function assertApprovedUrl(url: URL, approvedHost: string): void {
  if (url.protocol !== "https:") {
    throw new IngestionError("disallowed_url", `URL protocol "${url.protocol}" is not https:.`, { context: { url: url.toString() } });
  }
  if (url.username !== "" || url.password !== "") {
    throw new IngestionError("disallowed_url", "URL must not contain embedded credentials.", { context: { url: url.toString() } });
  }
  if (url.hostname !== approvedHost) {
    throw new IngestionError("disallowed_url", `URL host "${url.hostname}" is not the approved host "${approvedHost}".`, {
      context: { url: url.toString() },
    });
  }
  if (url.port !== "") {
    throw new IngestionError("disallowed_url", `URL must not specify a non-default port (got "${url.port}").`, {
      context: { url: url.toString() },
    });
  }
}

function buildUrl(baseUrl: string, approvedHost: string, path: string): URL {
  const url = new URL(path, baseUrl);
  assertApprovedUrl(url, approvedHost);
  return url;
}

export function buildTeamUrl(baseUrl: string, approvedHost: string, vlrTeamId: string): URL {
  assertValidId(vlrTeamId, "vlrTeamId");
  return buildUrl(baseUrl, approvedHost, `/team/${vlrTeamId}`);
}

export function buildEventUrl(baseUrl: string, approvedHost: string, vlrEventId: string): URL {
  assertValidId(vlrEventId, "vlrEventId");
  return buildUrl(baseUrl, approvedHost, `/event/${vlrEventId}`);
}

export function buildEventMatchesUrl(baseUrl: string, approvedHost: string, vlrEventId: string): URL {
  assertValidId(vlrEventId, "vlrEventId");
  return buildUrl(baseUrl, approvedHost, `/event/matches/${vlrEventId}`);
}

export function buildMatchUrl(baseUrl: string, approvedHost: string, vlrMatchId: string): URL {
  assertValidId(vlrMatchId, "vlrMatchId");
  return buildUrl(baseUrl, approvedHost, `/${vlrMatchId}`);
}

/** Bounded discovery listing page, page number only — never an arbitrary query string. */
export function buildEventListUrl(baseUrl: string, approvedHost: string, page: number): URL {
  if (!Number.isInteger(page) || page < 1 || page > 500) {
    throw new IngestionError("invalid_backfill_scope", `Discovery page number "${page}" is out of the safe range [1, 500].`);
  }
  const url = buildUrl(baseUrl, approvedHost, "/events");
  url.searchParams.set("page", String(page));
  return url;
}
