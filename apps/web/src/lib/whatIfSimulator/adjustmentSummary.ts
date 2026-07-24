import { ALL_ATTRIBUTE_CONTROLS, type MapDraftAdjustment, type TeamDraftAdjustment } from "./types";

const EMPTY_SUMMARY = "No hypothetical adjustments applied.";

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function summarizeTeamDraft(teamName: string, draft: TeamDraftAdjustment): string | null {
  const parts = ALL_ATTRIBUTE_CONTROLS.filter((control) => draft[control.key] !== 0).map(
    (control) => `${control.label} ${formatDelta(draft[control.key])}`,
  );
  if (parts.length === 0) return null;
  return `${teamName}: ${parts.join(", ")}`;
}

function summarizeMapDraft(teamName: string, mapDraft: MapDraftAdjustment, mapLabel: (mapId: string) => string): string[] {
  return Object.entries(mapDraft)
    .filter(([, delta]) => delta !== 0)
    .sort(([a], [b]) => mapLabel(a).localeCompare(mapLabel(b)))
    .map(([mapId, delta]) => `${mapLabel(mapId)} ${teamName} ${formatDelta(delta)}`);
}

/**
 * TASK-038 compact, deterministic, screen-reader-friendly summary of every
 * non-zero draft adjustment — omits anything left at baseline (0), and
 * returns the explicit empty-state sentence when nothing has been changed.
 * Never renders raw JSON.
 */
export function summarizeAdjustments(
  teamAName: string,
  teamBName: string,
  teamADraft: TeamDraftAdjustment,
  teamBDraft: TeamDraftAdjustment,
  mapADraft: MapDraftAdjustment,
  mapBDraft: MapDraftAdjustment,
  mapLabel: (mapId: string) => string,
): string {
  const sentences: string[] = [];

  const teamASummary = summarizeTeamDraft(teamAName, teamADraft);
  if (teamASummary) sentences.push(teamASummary);

  const teamBSummary = summarizeTeamDraft(teamBName, teamBDraft);
  if (teamBSummary) sentences.push(teamBSummary);

  const mapParts = [...summarizeMapDraft(teamAName, mapADraft, mapLabel), ...summarizeMapDraft(teamBName, mapBDraft, mapLabel)];
  if (mapParts.length > 0) sentences.push(`Maps: ${mapParts.join(", ")}`);

  if (sentences.length === 0) return EMPTY_SUMMARY;
  return `${sentences.join(". ")}.`;
}
