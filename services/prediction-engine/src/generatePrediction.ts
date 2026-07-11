import { randomUUID } from "node:crypto";
import type { PredictionRequest, PredictionResult } from "@repo/shared";
import { teams } from "./data/teams";
import { seededRatio } from "./lib/seededRatio";
import { generateTeamDna } from "./lib/teamDna";
import { generateMatchDna } from "./lib/matchDna";
import { generateKeyFactors, generateInsights } from "./lib/insights";
import { generatePipeline } from "./lib/pipeline";
import { getCached, scenarioCacheKey, setCached } from "./cache";

function computePrediction(request: PredictionRequest): PredictionResult {
  const { scenario } = request;
  const teamA = teams.find((team) => team.id === scenario.teamAId);
  const teamB = teams.find((team) => team.id === scenario.teamBId);

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
  const insights = generateInsights(insightInput, keyFactors);
  const pipeline = generatePipeline(request.requestId);

  const topFactor = keyFactors[0];
  const explanation = topFactor
    ? `${winner.name} is favored primarily due to a ${topFactor.label.toLowerCase()} advantage over ${loser.name}. ${insights.find((i) => i.kind === "deciding-factor")?.description ?? ""}`
    : `${winner.name} and ${loser.name} are closely matched across every measured dimension, so this prediction leans on aggregate win probability alone.`;

  return {
    predictionId: randomUUID(),
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
    warnings: [
      "This prediction was generated from a deterministic heuristic over synthetic data — no live match data source is connected yet.",
    ],
    generatedAt: new Date().toISOString(),
    predictionVersion: "engine-0.2",
  };
}

/**
 * Scenario content is what determines the analytical result, so cache hits
 * reuse the computed DNA/probabilities/insights. Everything specific to this
 * request — predictionId, requestId, the submitted scenario (mapIds order
 * isn't part of the cache key), and the requestId-seeded pipeline — is always
 * stamped fresh, even when the underlying analysis is reused.
 */
export function generatePrediction(request: PredictionRequest): PredictionResult {
  const key = scenarioCacheKey(request.scenario);
  const cached = getCached(key);

  if (cached) {
    return {
      ...cached,
      predictionId: randomUUID(),
      requestId: request.requestId,
      scenario: request.scenario,
      pipeline: generatePipeline(request.requestId),
      generatedAt: new Date().toISOString(),
    };
  }

  const result = computePrediction(request);
  setCached(key, result);
  return result;
}
