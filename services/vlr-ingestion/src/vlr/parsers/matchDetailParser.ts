import type { RawSourceMetadata, VlrMapResult, VlrMatchDetail, VlrMatchStatus } from "../schemas/raw";
import { extractAttribute, extractIdFromUrl, extractText, parseHtmlDocument, PARSER_VERSION } from "./htmlUtils";
import type { ParseIssue, ParseOutcome } from "./htmlUtils";

/**
 * Match-detail page parser — see docs/29-vlr-data-ingestion-foundation.md
 * ("Parsing") and TASK-041 requirement 14/17. A completed match with no
 * discoverable winner is not rejected outright (the record may still be
 * useful for map-level analysis) — it is returned with an
 * `inconsistent_winner` warning, and `trainingEligibility` (a later stage)
 * is what actually excludes it from the approved dataset.
 */

const MATCH_ID_FROM_URL = /^\/(\d+)/;
const VALID_STATUSES: readonly VlrMatchStatus[] = ["upcoming", "live", "completed", "postponed", "cancelled"];

function parseScore(text: string | undefined): number | null {
  if (text === undefined) return null;
  const parsed = Number.parseInt(text, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseMap(element: Element, warnings: ParseIssue[]): VlrMapResult | null {
  const order = Number.parseInt(extractAttribute(element, "data-order") ?? "", 10);
  const mapNameRaw = extractAttribute(element, "data-map");
  if (!Number.isInteger(order) || !mapNameRaw) {
    warnings.push({ code: "partial_record", message: "Skipped a map slot missing an order or map name.", selector: ".match-map" });
    return null;
  }

  const teamAScore = parseScore(extractText(element.querySelector(".map-score-a")));
  const teamBScore = parseScore(extractText(element.querySelector(".map-score-b")));

  return {
    mapNameRaw,
    order,
    teamAScore,
    teamBScore,
    teamAAttackScore: parseScore(extractText(element.querySelector(".map-score-a-atk"))) ?? undefined,
    teamADefenseScore: parseScore(extractText(element.querySelector(".map-score-a-def"))) ?? undefined,
    teamBAttackScore: parseScore(extractText(element.querySelector(".map-score-b-atk"))) ?? undefined,
    teamBDefenseScore: parseScore(extractText(element.querySelector(".map-score-b-def"))) ?? undefined,
    winnerVlrTeamId: extractAttribute(element.querySelector(".map-winner"), "data-team-id"),
    overtime: extractAttribute(element, "data-overtime") === "true",
  };
}

export function parseMatchDetailPage(html: string, source: { sourceUrl: string; fetchedAt: string; vlrEventId: string }): ParseOutcome<VlrMatchDetail> {
  const document = parseHtmlDocument(html);
  const errors: ParseIssue[] = [];
  const warnings: ParseIssue[] = [];

  const root = document.querySelector(".match-page");
  if (!root) {
    errors.push({ code: "critical_field_missing", message: "No .match-page root element found.", selector: ".match-page" });
    return { value: null, warnings, errors, parserVersion: PARSER_VERSION };
  }

  let vlrMatchId = extractIdFromUrl(source.sourceUrl, MATCH_ID_FROM_URL);
  if (!vlrMatchId) {
    vlrMatchId = extractAttribute(root, "data-match-id");
    if (vlrMatchId) warnings.push({ code: "parser_fallback_used", message: "Match ID recovered from data-match-id fallback, not the URL." });
  }
  if (!vlrMatchId) errors.push({ code: "critical_field_missing", message: "Could not determine the match's VLR ID." });

  const header = root.querySelector(".match-header");
  if (!header) errors.push({ code: "critical_field_missing", message: "No .match-header element found.", selector: ".match-header" });

  const statusRaw = extractAttribute(header, "data-status")?.toLowerCase();
  const status = VALID_STATUSES.find((candidate) => candidate === statusRaw);
  if (!status) errors.push({ code: "critical_field_missing", message: `Match status "${statusRaw ?? "(missing)"}" is not recognized.`, selector: ".match-header" });

  const teamElements = header ? Array.from(header.querySelectorAll(".match-team")) : [];
  const teamAVlrTeamId = extractAttribute(teamElements[0], "data-team-id");
  const teamBVlrTeamId = extractAttribute(teamElements[1], "data-team-id");
  if (!teamAVlrTeamId || !teamBVlrTeamId) {
    errors.push({ code: "critical_field_missing", message: "Both competing teams are required but at least one is missing.", selector: ".match-team" });
  }

  if (errors.length > 0) {
    return { value: null, warnings, errors, parserVersion: PARSER_VERSION };
  }

  const winnerElement = teamElements.find((el) => extractAttribute(el, "data-winner") === "true");
  const winnerVlrTeamId = extractAttribute(winnerElement, "data-team-id");
  if (status === "completed" && !winnerVlrTeamId) {
    warnings.push({ code: "inconsistent_winner", message: "Match is marked completed but no team is flagged as the winner." });
  }

  const mapElements = Array.from(root.querySelectorAll(".match-map"));
  const maps = mapElements.map((element) => parseMap(element, warnings)).filter((map): map is VlrMapResult => map !== null);
  if (status === "completed" && maps.length === 0) {
    warnings.push({ code: "missing_map_score", message: "Match is marked completed but no map results were found." });
  }

  const scheduledAtRaw = extractAttribute(header, "data-scheduled");
  const scheduledAtIso = scheduledAtRaw && !Number.isNaN(Date.parse(scheduledAtRaw)) ? scheduledAtRaw : undefined;
  if (scheduledAtRaw && !scheduledAtIso) {
    warnings.push({ code: "ambiguous_timezone", message: "Scheduled timestamp was present but not an unambiguous ISO 8601 value." });
  }

  const sourceMetadata: RawSourceMetadata = { sourceUrl: source.sourceUrl, fetchedAt: source.fetchedAt, parserVersion: PARSER_VERSION };

  const detail: VlrMatchDetail = {
    vlrMatchId: vlrMatchId!,
    matchUrl: source.sourceUrl,
    teamAVlrTeamId: teamAVlrTeamId!,
    teamBVlrTeamId: teamBVlrTeamId!,
    winnerVlrTeamId,
    seriesFormatRaw: extractText(header!.querySelector(".match-series-format")),
    maps,
    vlrEventId: source.vlrEventId,
    patch: extractText(header!.querySelector(".match-patch")),
    status: status!,
    scheduledAtRaw,
    scheduledAtIso,
    source: sourceMetadata,
  };

  return { value: detail, warnings, errors, parserVersion: PARSER_VERSION };
}
