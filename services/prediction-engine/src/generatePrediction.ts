import { randomUUID } from "node:crypto";
import type { PredictionRequest, PredictionResult } from "@repo/shared";
import { teams } from "./data/teams";
import { computeFormStability, generateTeamDna, getFeatureCoverage, clampScore } from "./lib/teamDna";
import { computeDimensionAgreement, computeWeightedAdvantage, generateMatchDna } from "./lib/matchDna";
import { generateKeyFactors, generateInsights } from "./lib/insights";
import { getHeadToHead, getRecentForm } from "./lib/analyticsEngine";
import { generatePipeline } from "./lib/pipeline";
import { getCached, scenarioCacheKey, setCached } from "./cache";

const MIN_WIN_PROBABILITY = 0.05;
const MAX_WIN_PROBABILITY = 0.95;
/** Tunes how sharply a DNA advantage translates into win probability. */
const WIN_PROBABILITY_STEEPNESS = 0.04;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampProbability(value: number): number {
  return Math.min(MAX_WIN_PROBABILITY, Math.max(MIN_WIN_PROBABILITY, value));
}

/**
 * Win probability, confidence, and trust score are all derived from the
 * feature-driven Team DNA / Match DNA comparison (TASK-016) rather than an
 * independent random draw — see docs/16-prediction-pipeline.md (Steps 7-8)
 * and docs/00a-ubiquitous-language.md ("Confidence", "Trust Score").
 */
function computePrediction(request: PredictionRequest): PredictionResult {
  const { scenario } = request;
  const teamA = teams.find((team) => team.id === scenario.teamAId);
  const teamB = teams.find((team) => team.id === scenario.teamBId);

  if (!teamA || !teamB) {
    throw new Error("Unknown team in scenario");
  }

  const teamADna = generateTeamDna(teamA.id);
  const teamBDna = generateTeamDna(teamB.id);
  const matchDna = generateMatchDna(teamADna, teamBDna);

  const weightedAdvantage = computeWeightedAdvantage(teamADna, teamBDna);
  const teamAWinProbability = round2(
    clampProbability(1 / (1 + Math.exp(-WIN_PROBABILITY_STEEPNESS * weightedAdvantage))),
  );
  const teamBWinProbability = round2(1 - teamAWinProbability);
  const predictedWinnerId = teamAWinProbability >= teamBWinProbability ? teamA.id : teamB.id;
  const winner = predictedWinnerId === teamA.id ? teamA : teamB;
  const loser = predictedWinnerId === teamA.id ? teamB : teamA;

  // Confidence: how much the individual DNA dimensions agree with the
  // overall verdict, combined with how stable each team's recent form is
  // relative to its overall performance (docs/16-prediction-pipeline.md,
  // Step 8: "data quality, historical consistency, feature agreement").
  const dimensionAgreement = computeDimensionAgreement(teamADna, teamBDna, weightedAdvantage);
  const formStability = (computeFormStability(teamA.id) + computeFormStability(teamB.id)) / 2;
  const confidence = clampScore((dimensionAgreement * 0.6 + formStability * 0.4) * 100);

  // Trust Score: feature coverage (did both teams have enough normalized
  // data for every registered feature) combined with confidence, per
  // docs/00a-ubiquitous-language.md ("Trust Score").
  const featureCoverage = (getFeatureCoverage(teamA.id) + getFeatureCoverage(teamB.id)) / 2;
  const trustScore = clampScore((featureCoverage * 0.5 + (confidence / 100) * 0.5) * 100);

  const winnerDna = predictedWinnerId === teamA.id ? teamADna : teamBDna;
  const loserDna = predictedWinnerId === teamA.id ? teamBDna : teamADna;

  // Head-to-head and recent form come from the Analytics Engine (TASK-017),
  // which sits alongside the Prediction pipeline per docs/05-domain-model.md,
  // and feed the Explainability Pipeline's Supporting Evidence
  // (docs/03-system-architecture.md, docs/10-prediction-engine.md).
  const headToHead = getHeadToHead(winner.id, loser.id);
  const winnerRecentForm = getRecentForm(winner.id)?.last5 ?? null;
  const loserRecentForm = getRecentForm(loser.id)?.last5 ?? null;

  const insightInput = {
    winner,
    loser,
    winnerDna,
    loserDna,
    matchDna,
    confidence,
    trustScore,
    headToHead,
    winnerRecentForm,
    loserRecentForm,
    dimensionAgreement,
    formStability,
    featureCoverage,
  };
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
