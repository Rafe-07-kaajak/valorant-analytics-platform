export type SeriesFormat = "BO3" | "BO5";

export interface Scenario {
  teamAId: string;
  teamBId: string;
  seriesFormat: SeriesFormat;
  mapIds: string[];
}

export interface PredictionRequest {
  requestId: string;
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
  warnings: string[];
  generatedAt: string;
  predictionVersion: string;
}
