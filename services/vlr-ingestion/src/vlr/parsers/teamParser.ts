import type { RawSourceMetadata, VlrTeam } from "../schemas/raw";
import { extractAttribute, extractIdFromUrl, extractText, parseHtmlDocument, PARSER_VERSION } from "./htmlUtils";
import type { ParseIssue, ParseOutcome } from "./htmlUtils";

/**
 * Team page parser — see docs/29-vlr-data-ingestion-foundation.md
 * ("Parsing"), TASK-041 requirement 14/15, and TASK-042's live-markup
 * verification.
 *
 * Primary identity selector: the team ID embedded in the source URL
 * (`/team/<id>/...`), matching how VLR structures team page URLs. Falls
 * back to a `data-team-id` attribute on the root container if the URL
 * shape ever changes — a fallback the fixture suite exercises directly.
 * Real markup (verified live) nests the display name (`h1.wf-title`) and
 * short tag (`h2.team-header-tag`) both inside `.team-header-name`, so the
 * name is read from the `h1` specifically rather than the whole container
 * (whose combined text would otherwise run the name and tag together).
 */

const TEAM_ID_FROM_URL = /\/team\/(\d+)/;
const PLAYER_ID_FROM_HREF = /\/player\/(\d+)/;

export function parseTeamPage(html: string, source: { sourceUrl: string; fetchedAt: string }): ParseOutcome<VlrTeam> {
  const document = parseHtmlDocument(html);
  const errors: ParseIssue[] = [];
  const warnings: ParseIssue[] = [];

  const root = document.querySelector(".team-header");
  if (!root) {
    errors.push({ code: "critical_field_missing", message: "No .team-header root element found.", selector: ".team-header" });
    return { value: null, warnings, errors, parserVersion: PARSER_VERSION };
  }

  let vlrTeamId = extractIdFromUrl(source.sourceUrl, TEAM_ID_FROM_URL);
  if (!vlrTeamId) {
    vlrTeamId = extractAttribute(root, "data-team-id");
    if (vlrTeamId) {
      warnings.push({ code: "parser_fallback_used", message: "Team ID recovered from data-team-id fallback, not the source URL." });
    }
  }
  if (!vlrTeamId) {
    errors.push({ code: "critical_field_missing", message: "Could not determine the team's VLR ID from the URL or a fallback attribute." });
  }

  const name = extractText(root.querySelector(".team-header-name h1"));
  if (!name) {
    errors.push({ code: "critical_field_missing", message: "Team name is required but missing.", selector: ".team-header-name h1" });
  }

  if (errors.length > 0) {
    return { value: null, warnings, errors, parserVersion: PARSER_VERSION };
  }

  const shortName = extractText(root.querySelector(".team-header-tag"));
  const region = extractText(root.querySelector(".team-header-country"));
  const logoUrl = extractAttribute(root.querySelector(".team-header-logo img"), "src");

  const rosterLinks = Array.from(document.querySelectorAll(".team-roster-item a"));
  const activeRosterVlrPlayerIds = rosterLinks
    .map((link) => extractIdFromUrl(extractAttribute(link, "href") ?? "", PLAYER_ID_FROM_HREF))
    .filter((id): id is string => id !== undefined);
  if (rosterLinks.length > 0 && activeRosterVlrPlayerIds.length < rosterLinks.length) {
    warnings.push({ code: "partial_record", message: "One or more roster entries had no extractable player ID." });
  }

  const sourceMetadata: RawSourceMetadata = { sourceUrl: source.sourceUrl, fetchedAt: source.fetchedAt, parserVersion: PARSER_VERSION };

  const team: VlrTeam = {
    vlrTeamId: vlrTeamId!,
    name: name!,
    shortName,
    region,
    profileUrl: source.sourceUrl,
    logoUrl: logoUrl ? new URL(logoUrl, source.sourceUrl).toString() : undefined,
    activeRosterVlrPlayerIds: activeRosterVlrPlayerIds.length > 0 ? activeRosterVlrPlayerIds : undefined,
    source: sourceMetadata,
  };

  return { value: team, warnings, errors, parserVersion: PARSER_VERSION };
}
