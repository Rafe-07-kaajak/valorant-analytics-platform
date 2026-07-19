import type { FeatureRow } from "../feature/types";
import type { RowPrediction } from "./artifact";
import { logLoss } from "./metrics";

/**
 * Error analysis over the frozen model's final test-set predictions —
 * TASK-045 requirement 13. Every diagnostic here is computed strictly from
 * already-produced predictions and the test rows' own pre-match features;
 * nothing here influences model selection (which was frozen before the
 * test set was ever evaluated). Never surfaces player personal data beyond
 * the provider IDs already present in the feature dataset.
 */

const TOP_N = 10;
const HIGH_REST_IMBALANCE_DAYS = 7;
const MAJOR_ELO_DISAGREEMENT_THRESHOLD = 0.3;
const PROBABILITY_EXTREME_THRESHOLD = 0.05;

export interface ErrorAnalysisEntry {
  readonly matchInternalId: string;
  readonly predicted: number;
  readonly actual: number;
  readonly correct: boolean;
  readonly confidence: number;
}

export interface GroupErrorRate {
  readonly errors: number;
  readonly total: number;
  readonly errorRate: number;
  readonly logLoss: number;
}

export interface EloDisagreementEntry {
  readonly matchInternalId: string;
  readonly modelProbability: number;
  readonly eloProbability: number;
  readonly absoluteDifference: number;
}

export interface ErrorAnalysisReport {
  readonly highestConfidenceIncorrect: readonly ErrorAnalysisEntry[];
  readonly lowestConfidenceCorrect: readonly ErrorAnalysisEntry[];
  readonly coldStart: GroupErrorRate;
  readonly established: GroupErrorRate;
  readonly byTournamentLevel: Readonly<Record<string, GroupErrorRate>>;
  readonly bySeriesFormat: Readonly<Record<string, GroupErrorRate>>;
  readonly orientation: { readonly whenTeamAWon: GroupErrorRate; readonly whenTeamBWon: GroupErrorRate };
  readonly rosterIncomplete: GroupErrorRate;
  readonly highRestImbalance: GroupErrorRate;
  readonly majorEloDisagreements: readonly EloDisagreementEntry[];
  readonly probabilityExtremeCount: number;
}

function groupErrorRate(entries: readonly ErrorAnalysisEntry[]): GroupErrorRate {
  const errors = entries.filter((e) => !e.correct).length;
  return {
    errors,
    total: entries.length,
    errorRate: entries.length > 0 ? errors / entries.length : 0,
    logLoss: entries.length > 0 ? logLoss(entries.map((e) => e.actual), entries.map((e) => e.predicted)) : 0,
  };
}

export function buildErrorAnalysis(testRows: readonly FeatureRow[], predictions: readonly RowPrediction[]): ErrorAnalysisReport {
  const predictionByMatch = new Map(predictions.map((p) => [p.matchInternalId, p]));
  const entries: (ErrorAnalysisEntry & { readonly row: FeatureRow })[] = testRows
    .map((row) => {
      const prediction = predictionByMatch.get(row.matchInternalId);
      if (!prediction) return null;
      const predicted = prediction.predictedCalibrated;
      const actual = prediction.actual;
      const correct = (predicted >= 0.5 ? 1 : 0) === actual;
      return { matchInternalId: row.matchInternalId, predicted, actual, correct, confidence: Math.abs(predicted - 0.5), row };
    })
    .filter((e): e is ErrorAnalysisEntry & { readonly row: FeatureRow } => e !== null);

  const incorrect = entries.filter((e) => !e.correct).sort((a, b) => b.confidence - a.confidence);
  const correct = entries.filter((e) => e.correct).sort((a, b) => a.confidence - b.confidence);

  const coldStartEntries = entries.filter((e) => e.row.teamAIsColdStart || e.row.teamBIsColdStart);
  const establishedEntries = entries.filter((e) => !e.row.teamAIsColdStart && !e.row.teamBIsColdStart);

  const byTournamentLevel: Record<string, GroupErrorRate> = {};
  for (const level of new Set(entries.map((e) => e.row.tournamentLevel))) {
    byTournamentLevel[level] = groupErrorRate(entries.filter((e) => e.row.tournamentLevel === level));
  }

  const bySeriesFormat: Record<string, GroupErrorRate> = {};
  for (const format of new Set(entries.map((e) => e.row.seriesFormat))) {
    bySeriesFormat[format] = groupErrorRate(entries.filter((e) => e.row.seriesFormat === format));
  }

  const rosterIncompleteEntries = entries.filter((e) => !e.row.teamARosterSnapshotAvailable || !e.row.teamBRosterSnapshotAvailable);
  const highRestImbalanceEntries = entries.filter((e) => e.row.restDifferenceDays !== null && Math.abs(e.row.restDifferenceDays) >= HIGH_REST_IMBALANCE_DAYS);

  const majorEloDisagreements: EloDisagreementEntry[] = entries
    .map((e) => ({ matchInternalId: e.matchInternalId, modelProbability: e.predicted, eloProbability: e.row.teamAEloWinProbability, absoluteDifference: Math.abs(e.predicted - e.row.teamAEloWinProbability) }))
    .filter((e) => e.absoluteDifference >= MAJOR_ELO_DISAGREEMENT_THRESHOLD)
    .sort((a, b) => b.absoluteDifference - a.absoluteDifference);

  const probabilityExtremeCount = entries.filter((e) => e.predicted <= PROBABILITY_EXTREME_THRESHOLD || e.predicted >= 1 - PROBABILITY_EXTREME_THRESHOLD).length;

  return {
    highestConfidenceIncorrect: incorrect.slice(0, TOP_N).map((e) => ({ matchInternalId: e.matchInternalId, predicted: e.predicted, actual: e.actual, correct: e.correct, confidence: e.confidence })),
    lowestConfidenceCorrect: correct.slice(0, TOP_N).map((e) => ({ matchInternalId: e.matchInternalId, predicted: e.predicted, actual: e.actual, correct: e.correct, confidence: e.confidence })),
    coldStart: groupErrorRate(coldStartEntries),
    established: groupErrorRate(establishedEntries),
    byTournamentLevel,
    bySeriesFormat,
    orientation: {
      whenTeamAWon: groupErrorRate(entries.filter((e) => e.actual === 1)),
      whenTeamBWon: groupErrorRate(entries.filter((e) => e.actual === 0)),
    },
    rosterIncomplete: groupErrorRate(rosterIncompleteEntries),
    highRestImbalance: groupErrorRate(highRestImbalanceEntries),
    majorEloDisagreements: majorEloDisagreements.slice(0, TOP_N),
    probabilityExtremeCount,
  };
}
