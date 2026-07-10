import type { PredictionRequest, PredictionResult } from "@repo/shared";
import { mockTeams } from "./teams";

function seededRatio(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 1000) / 1000;
}

export function generateMockPrediction(request: PredictionRequest): PredictionResult {
  const { scenario } = request;
  const teamA = mockTeams.find((team) => team.id === scenario.teamAId);
  const teamB = mockTeams.find((team) => team.id === scenario.teamBId);

  if (!teamA || !teamB) {
    throw new Error("Unknown team in scenario");
  }

  const ratio = seededRatio(`${teamA.id}:${teamB.id}:${scenario.seriesFormat}`);
  const teamAWinProbability = Math.round((0.3 + ratio * 0.4) * 100) / 100;
  const teamBWinProbability = Math.round((1 - teamAWinProbability) * 100) / 100;
  const predictedWinnerId = teamAWinProbability >= teamBWinProbability ? teamA.id : teamB.id;

  const confidence = Math.round(60 + seededRatio(`confidence:${teamA.id}:${teamB.id}`) * 35);
  const trustScore = Math.round(70 + seededRatio(`trust:${teamA.id}:${teamB.id}`) * 25);

  return {
    predictionId: crypto.randomUUID(),
    requestId: request.requestId,
    scenario,
    outcomes: [
      { teamId: teamA.id, winProbability: teamAWinProbability },
      { teamId: teamB.id, winProbability: teamBWinProbability },
    ],
    predictedWinnerId,
    confidence,
    trustScore,
    explanation: "Detailed reasoning is not yet available — this prediction runs on mock data.",
    warnings: ["This prediction was generated from mock data, not the real Prediction Engine."],
    generatedAt: new Date().toISOString(),
    predictionVersion: "mock-0.1",
  };
}
