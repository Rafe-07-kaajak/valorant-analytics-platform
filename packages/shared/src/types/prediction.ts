import type { MatchDna, TeamDna } from "./team-dna";
import type { Insight, KeyFactor, PipelineStage } from "./insight";

export type SeriesFormat = "BO3" | "BO5";

export const SERIES_MAP_LIMITS: Record<SeriesFormat, number> = { BO3: 3, BO5: 5 };

export interface Scenario {
  teamAId: string;
  teamBId: string;
  seriesFormat: SeriesFormat;
  mapIds: string[];
}

export interface PredictionRequest {
  requestId: string;
  clientVersion: string;
  timestamp: string;
  scenario: Scenario;
}

export interface TeamPredictionOutcome {
  teamId: string;
  winProbability: number;
}

export interface PredictionResult {
  predictionId: string;
  requestId: string;
  scenario: Scenario;
  outcomes: [TeamPredictionOutcome, TeamPredictionOutcome];
  predictedWinnerId: string;
  confidence: number;
  trustScore: number;
  explanation: string;
  teamDna: [TeamDna, TeamDna];
  matchDna: MatchDna;
  keyFactors: KeyFactor[];
  insights: Insight[];
  pipeline: PipelineStage[];
  warnings: string[];
  generatedAt: string;
  predictionVersion: string;
}
