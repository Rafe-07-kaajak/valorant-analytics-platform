import type { RawSourceMetadata, VlrMapResult, VlrMatchDetail, VlrMatchStatus } from "../schemas/raw";
import { parseUtcTsAttribute } from "../../normalize/dateNormalization";
import { extractAttribute, extractIdFromUrl, extractText, parseHtmlDocument, PARSER_VERSION } from "./htmlUtils";
import type { ParseIssue, ParseOutcome } from "./htmlUtils";

/**
 * Match-detail page parser — see docs/29-vlr-data-ingestion-foundation.md
 * ("Parsing"), TASK-041 requirement 14/17, and TASK-042's live-markup
 * verification. A completed match with no discoverable winner is not
 * rejected outright (the record may still be useful for map-level
 * analysis) — it is returned with an `inconsistent_winner` warning, and
 * `trainingEligibility` (a later stage) is what actually excludes it from
 * the approved dataset.
 *
 * Real match-detail markup (verified live) has no `.match-page` wrapper or
 * `data-status`/`data-team-id` attributes: team identity comes from
 * `.match-header-link[href^="/team/<id>/"]`, the series score from ordered
 * `.match-header-vs-score-winner`/`-loser` spans (document order = team A
 * then team B, independent of who won), and the timestamp from a
 * `data-utc-ts` attribute on a `.moment-tz-convert` node (the only
 * unambiguous UTC source anywhere on the page). Per-map results live in a
 * separate `.vm-stats-game[data-game-id]` block per map, joined against the
 * map picker's `.vm-stats-gamesnav-item` (which alone carries the map's
 * order and name) by that shared `data-game-id` — an unplayed map slot
 * (e.g. a Bo3's untouched decider) has a gamesnav entry but no matching
 * stats block, which this parser reports as an unplayed map (`null`
 * scores) rather than skipping it.
 *
 * Real markup carries no status text on the match-detail page itself
 * (`.match-header-vs-note` says "final"/"LIVE" or nothing at all) —
 * `statusHint`, carried from the match-list discovery entry that led to
 * this fetch, is preferred; the note text is only a best-effort fallback
 * when no hint is available (e.g. the standalone one-off match CLI
 * command).
 */

const MATCH_ID_FROM_URL = /\/(\d+)(?:[/?]|$)/;
const TEAM_ID_FROM_HREF = /\/team\/(\d+)/;
const PLAYER_ID_FROM_HREF = /\/player\/(\d+)/;
const VALID_STATUSES: readonly VlrMatchStatus[] = ["upcoming", "live", "completed", "postponed", "cancelled"];
const SERIES_FORMAT_NOTE_PATTERN = /^\s*bo\s*\d+\s*$/i;
const OVERTIME_THRESHOLD = 13;

/**
 * Extracts the roster that actually played, from the aggregate "All Maps"
 * stats table (`data-game-id="all"`) — the only place a specific match's
 * actual lineup appears; the team page's roster is today's roster, not this
 * match's, and must never be used as a stand-in (TASK-042 requirement 11:
 * "do not infer historical roster membership beyond source evidence").
 * Player rows are grouped by splitting the list in document order at the
 * halfway point — VLR consistently lists team A's five rows before team
 * B's — and any non-even split is flagged rather than guessed away.
 */
function parseRosters(
  doc: Document,
  teamAVlrTeamId: string,
  teamBVlrTeamId: string,
  warnings: ParseIssue[],
): readonly { teamVlrTeamId: string; vlrPlayerIds: readonly string[] }[] | undefined {
  const aggregateBlock = Array.from(doc.querySelectorAll(".vm-stats-game")).find((el) => extractAttribute(el, "data-game-id") === "all");
  if (!aggregateBlock) return undefined;

  const playerLinks = Array.from(aggregateBlock.querySelectorAll(".ovw-player a[href*='/player/']"));
  const playerIds = playerLinks.map((link) => extractIdFromUrl(extractAttribute(link, "href") ?? "", PLAYER_ID_FROM_HREF)).filter((id): id is string => id !== undefined);
  if (playerIds.length === 0) return undefined;

  if (playerIds.length % 2 !== 0) {
    warnings.push({ code: "incomplete_roster", message: `Found an odd number of roster player rows (${playerIds.length}); cannot split evenly between the two teams.` });
    return undefined;
  }

  const half = playerIds.length / 2;
  return [
    { teamVlrTeamId: teamAVlrTeamId, vlrPlayerIds: playerIds.slice(0, half) },
    { teamVlrTeamId: teamBVlrTeamId, vlrPlayerIds: playerIds.slice(half) },
  ];
}

function parseScore(text: string | undefined): number | null {
  if (text === undefined) return null;
  const parsed = Number.parseInt(text, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function resolveStatus(header: Element, statusHint: VlrMatchStatus | undefined, warnings: ParseIssue[]): VlrMatchStatus | undefined {
  if (statusHint && VALID_STATUSES.includes(statusHint)) return statusHint;

  const noteTexts = Array.from(header.querySelectorAll(".match-header-vs-note")).map((el) => extractText(el)?.toLowerCase());
  if (noteTexts.some((text) => text === "final")) return "completed";
  if (noteTexts.some((text) => text === "live")) return "live";

  const hasUtcTs = header.querySelector(".moment-tz-convert[data-utc-ts]") !== null;
  if (hasUtcTs) {
    warnings.push({ code: "parser_fallback_used", message: "Match status inferred as upcoming (no statusHint, no 'final'/'LIVE' note) — a scheduled timestamp was present but nothing else confirmed the match had started." });
    return "upcoming";
  }
  return undefined;
}

function parseMaps(doc: Document, teamAVlrTeamId: string, teamBVlrTeamId: string, warnings: ParseIssue[]): VlrMapResult[] {
  const gamesnavItems = Array.from(doc.querySelectorAll(".vm-stats-gamesnav-item.js-map-switch")).filter(
    (item) => extractAttribute(item, "data-game-id") !== "all",
  );

  const maps: VlrMapResult[] = [];
  for (const item of gamesnavItems) {
    const gameId = extractAttribute(item, "data-game-id");
    if (!gameId) continue;

    const orderSpan = item.querySelector("span");
    const orderText = extractText(orderSpan);
    const order = Number.parseInt(orderText ?? "", 10);
    const fullText = extractText(item);
    const mapNameRaw = orderText && fullText ? fullText.replace(new RegExp(`^${orderText}\\s*`), "").trim() : undefined;

    if (!Number.isInteger(order) || !mapNameRaw) {
      warnings.push({ code: "partial_record", message: "Skipped a map picker entry missing an order or map name.", selector: ".vm-stats-gamesnav-item" });
      continue;
    }

    const statsBlock = Array.from(doc.querySelectorAll(".vm-stats-game")).find((el) => extractAttribute(el, "data-game-id") === gameId);
    if (!statsBlock) {
      // Gamesnav lists every map slot in the series format (e.g. all three
      // of a Bo3), including one never played because the series ended
      // early — no matching stats block is the real signal for that, not
      // an error.
      maps.push({ mapNameRaw, order, teamAScore: null, teamBScore: null, overtime: false });
      continue;
    }

    const teamElements = Array.from(statsBlock.querySelectorAll(".vm-stats-game-header > .team"));
    const teamAEl = teamElements.find((el) => !el.classList.contains("mod-right"));
    const teamBEl = teamElements.find((el) => el.classList.contains("mod-right"));

    const teamAScore = parseScore(extractText(teamAEl?.querySelector(".score")));
    const teamBScore = parseScore(extractText(teamBEl?.querySelector(".score")));
    const teamAAttackScore = parseScore(extractText(teamAEl?.querySelector("span.mod-t"))) ?? undefined;
    const teamADefenseScore = parseScore(extractText(teamAEl?.querySelector("span.mod-ct"))) ?? undefined;
    const teamBAttackScore = parseScore(extractText(teamBEl?.querySelector("span.mod-t"))) ?? undefined;
    const teamBDefenseScore = parseScore(extractText(teamBEl?.querySelector("span.mod-ct"))) ?? undefined;

    const teamAWon = teamAEl?.querySelector(".score")?.classList.contains("mod-win") ?? false;
    const teamBWon = teamBEl?.querySelector(".score")?.classList.contains("mod-win") ?? false;
    const winnerVlrTeamId = teamAWon ? teamAVlrTeamId : teamBWon ? teamBVlrTeamId : undefined;

    maps.push({
      mapNameRaw,
      order,
      teamAScore,
      teamBScore,
      teamAAttackScore,
      teamADefenseScore,
      teamBAttackScore,
      teamBDefenseScore,
      winnerVlrTeamId,
      overtime: (teamAScore ?? 0) > OVERTIME_THRESHOLD || (teamBScore ?? 0) > OVERTIME_THRESHOLD,
    });
  }

  return maps;
}

export function parseMatchDetailPage(
  html: string,
  source: { sourceUrl: string; fetchedAt: string; vlrEventId: string; statusHint?: VlrMatchStatus },
): ParseOutcome<VlrMatchDetail> {
  const document = parseHtmlDocument(html);
  const errors: ParseIssue[] = [];
  const warnings: ParseIssue[] = [];

  const header = document.querySelector(".match-header");
  if (!header) {
    errors.push({ code: "critical_field_missing", message: "No .match-header element found.", selector: ".match-header" });
    return { value: null, warnings, errors, parserVersion: PARSER_VERSION };
  }

  let vlrMatchId = extractIdFromUrl(source.sourceUrl, MATCH_ID_FROM_URL);
  if (!vlrMatchId) {
    vlrMatchId = extractAttribute(header, "data-match-id");
    if (vlrMatchId) warnings.push({ code: "parser_fallback_used", message: "Match ID recovered from data-match-id fallback, not the URL." });
  }
  if (!vlrMatchId) errors.push({ code: "critical_field_missing", message: "Could not determine the match's VLR ID." });

  const teamLinks = Array.from(header.querySelectorAll(".match-header-link"));
  const teamAVlrTeamId = extractIdFromUrl(extractAttribute(teamLinks[0], "href") ?? "", TEAM_ID_FROM_HREF);
  const teamBVlrTeamId = extractIdFromUrl(extractAttribute(teamLinks[1], "href") ?? "", TEAM_ID_FROM_HREF);
  if (!teamAVlrTeamId || !teamBVlrTeamId) {
    errors.push({ code: "critical_field_missing", message: "Both competing teams are required but at least one is missing.", selector: ".match-header-link" });
  }

  const status = resolveStatus(header, source.statusHint, warnings);
  if (!status) {
    errors.push({ code: "critical_field_missing", message: `Match status "${source.statusHint ?? "(missing)"}" could not be determined from a hint or the page itself.`, selector: ".match-header" });
  }

  if (errors.length > 0) {
    return { value: null, warnings, errors, parserVersion: PARSER_VERSION };
  }

  const scoreSpans = Array.from(header.querySelectorAll(".match-header-vs-score-winner, .match-header-vs-score-loser"));
  const teamAWinnerSpan = scoreSpans[0];
  const teamBWinnerSpan = scoreSpans[1];
  let winnerVlrTeamId: string | undefined;
  if (teamAWinnerSpan?.classList.contains("match-header-vs-score-winner")) winnerVlrTeamId = teamAVlrTeamId;
  else if (teamBWinnerSpan?.classList.contains("match-header-vs-score-winner")) winnerVlrTeamId = teamBVlrTeamId;
  if (status === "completed" && !winnerVlrTeamId) {
    warnings.push({ code: "inconsistent_winner", message: "Match is marked completed but no team is flagged as the winner." });
  }

  const maps = parseMaps(document, teamAVlrTeamId!, teamBVlrTeamId!, warnings);
  if (status === "completed" && maps.length === 0) {
    warnings.push({ code: "missing_map_score", message: "Match is marked completed but no map results were found." });
  }

  const rostersAtMatchTime = parseRosters(document, teamAVlrTeamId!, teamBVlrTeamId!, warnings);

  const noteTexts = Array.from(header.querySelectorAll(".match-header-vs-note")).map((el) => extractText(el));
  const seriesFormatRaw = noteTexts.find((text) => text && SERIES_FORMAT_NOTE_PATTERN.test(text));

  const patchElement = Array.from(header.querySelectorAll(".match-header-date *")).find((el) => extractText(el)?.toLowerCase().startsWith("patch "));
  const patch = extractText(patchElement);

  const utcElement = header.querySelector(".moment-tz-convert[data-utc-ts]");
  const utcTsRaw = extractAttribute(utcElement, "data-utc-ts");
  const scheduledAtIso = parseUtcTsAttribute(utcTsRaw);
  const dateTexts = Array.from(header.querySelectorAll(".match-header-date .moment-tz-convert")).map((el) => extractText(el));
  const scheduledAtRaw = dateTexts.filter((text): text is string => Boolean(text)).join(" ") || undefined;

  const sourceMetadata: RawSourceMetadata = { sourceUrl: source.sourceUrl, fetchedAt: source.fetchedAt, parserVersion: PARSER_VERSION };

  const detail: VlrMatchDetail = {
    vlrMatchId: vlrMatchId!,
    matchUrl: source.sourceUrl,
    teamAVlrTeamId: teamAVlrTeamId!,
    teamBVlrTeamId: teamBVlrTeamId!,
    winnerVlrTeamId,
    seriesFormatRaw,
    maps,
    vlrEventId: source.vlrEventId,
    rostersAtMatchTime,
    patch,
    status: status!,
    scheduledAtRaw,
    scheduledAtIso,
    source: sourceMetadata,
  };

  return { value: detail, warnings, errors, parserVersion: PARSER_VERSION };
}
