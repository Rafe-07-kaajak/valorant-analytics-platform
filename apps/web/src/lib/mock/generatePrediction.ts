import type { PredictionRequest, PredictionResult } from "@repo/shared";
import { mockTeams } from "./teams";
import { seededRatio } from "./seededRatio";
import { generateTeamDna } from "./teamDna";
import { generateMatchDna } from "./matchDna";
import { generateKeyFactors, generateInsights } from "./insights";
import { generatePipeline } from "./pipeline";

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
  const winner = predictedWinnerId === teamA.id ? teamA : teamB;
  const loser = predictedWinnerId === teamA.id ? teamB : teamA;

  const confidence = Math.round(60 + seededRatio(`confidence:${teamA.id}:${teamB.id}`) * 35);
  const trustScore = Math.round(70 + seededRatio(`trust:${teamA.id}:${teamB.id}`) * 25);

  const teamADna = generateTeamDna(teamA.id);
  const teamBDna = generateTeamDna(teamB.id);
  const winnerDna = predictedWinnerId === teamA.id ? teamADna : teamBDna;
  const loserDna = predictedWinnerId === teamA.id ? teamBDna : teamADna;
  const matchDna = generateMatchDna(teamADna, teamBDna);

  const insightInput = { winner, loser, winnerDna, loserDna, matchDna, confidence, trustScore };
  const keyFactors = generateKeyFactors(insightInput);
  const insights = generateInsights(insightInput);
  const pipeline = generatePipeline(request.requestId);

  const topFactor = keyFactors[0];
  const explanation = topFactor
    ? `${winner.name} is favored primarily due to a ${topFactor.label.toLowerCase()} advantage over ${loser.name}. ${insights.find((i) => i.kind === "deciding-factor")?.description ?? ""}`
    : `${winner.name} and ${loser.name} are closely matched across every measured dimension, so this prediction leans on aggregate win probability alone.`;

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
    explanation,
    teamDna: [teamADna, teamBDna],
    matchDna,
    keyFactors,
    insights,
    pipeline,
    warnings: ["This prediction was generated from mock data, not the real Prediction Engine."],
    generatedAt: new Date().toISOString(),
    predictionVersion: "mock-0.1",
  };
}
