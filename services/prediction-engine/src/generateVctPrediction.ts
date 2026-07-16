import { randomUUID } from "node:crypto";
import type { PredictionRequest, PredictionResult, Team } from "@repo/shared";
import type { VctTeamId } from "./data/vctTeams";
import { clampScore } from "./lib/teamDna";
import { computeDimensionAgreement, computeWeightedAdvantage, generateMatchDna } from "./lib/matchDna";
import { generateKeyFactors, generateInsights } from "./lib/insights";
import { generatePipeline } from "./lib/pipeline";
import { getCached, scenarioCacheKey, setCached } from "./cache";
import { getVctTeamProfile, VCT_PROFILE_DISCLOSURE, type VctTeamProfile } from "./lib/vctTeamProfiles";

/**
 * TASK-032 counterpart to `generatePrediction.ts`, for the TASK-031 32-team
 * roster. `generatePrediction.ts` sources Team DNA from the 8-team raw
 * match-history pipeline (`generateTeamDna` → `normalizedMatchHistory`),
 * which has no data for the new roster's ids. This function instead reads
 * each team's already-computed `dna` straight off its TASK-031
 * `VctTeamProfile` — no raw match corpus, no changes to the original file.
 *
 * `teamA`/`teamB` carry the *display* identity (name/region/logoUrl) that
 * TASK-030's web directory owns; this package never invents a display name.
 * Callers (the `/api/vct-prediction` route) resolve them from that
 * directory and pass them in, so this function's own `id` lookups
 * (`getVctTeamProfile`) stay the only place team identity is required to
 * originate from the engine's own TASK-031 roster.
 */

const MIN_WIN_PROBABILITY = 0.05;
const MAX_WIN_PROBABILITY = 0.95;
/** Mirrors `generatePrediction.ts`'s steepness so both prediction paths feel consistent. */
const WIN_PROBABILITY_STEEPNESS = 0.04;
/** Every TASK-031 DNA dimension is always populated by construction — there is no "insufficient data" case for modeled profiles, unlike the raw-match pipeline's coverage fraction. */
const VCT_FEATURE_COVERAGE = 1;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampProbability(value: number): number {
  return Math.min(MAX_WIN_PROBABILITY, Math.max(MIN_WIN_PROBABILITY, value));
}

/** Modeled analogue of `computeFormStability`: agreement between a team's long-run rating and its current-form trend. */
function computeVctFormStability(profile: VctTeamProfile): number {
  return 1 - Math.abs(profile.overallRating - profile.recentFormIndex) / 100;
}

function computeVctPrediction(request: PredictionRequest, teamA: Team, teamB: Team): PredictionResult {
  const { scenario } = request;

  if (teamA.id !== scenario.teamAId || teamB.id !== scenario.teamBId) {
    throw new Error("Resolved team identity does not match the submitted scenario.");
  }

  const profileA = getVctTeamProfile(teamA.id as VctTeamId);
  const profileB = getVctTeamProfile(teamB.id as VctTeamId);
  if (!profileA || !profileB) {
    throw new Error("Unknown VCT team in scenario.");
  }

  const teamADna = profileA.dna;
  const teamBDna = profileB.dna;
  const matchDna = generateMatchDna(teamADna, teamBDna);

  const weightedAdvantage = computeWeightedAdvantage(teamADna, teamBDna);
  const teamAWinProbability = round2(
    clampProbability(1 / (1 + Math.exp(-WIN_PROBABILITY_STEEPNESS * weightedAdvantage))),
  );
  const teamBWinProbability = round2(1 - teamAWinProbability);
  const predictedWinnerId = teamAWinProbability >= teamBWinProbability ? teamA.id : teamB.id;
  const winner = predictedWinnerId === teamA.id ? teamA : teamB;
  const loser = predictedWinnerId === teamA.id ? teamB : teamA;

  const dimensionAgreement = computeDimensionAgreement(teamADna, teamBDna, weightedAdvantage);
  const formStability = (computeVctFormStability(profileA) + computeVctFormStability(profileB)) / 2;
  const confidence = clampScore((dimensionAgreement * 0.6 + formStability * 0.4) * 100);
  const trustScore = clampScore((VCT_FEATURE_COVERAGE * 0.5 + (confidence / 100) * 0.5) * 100);

  const winnerDna = predictedWinnerId === teamA.id ? teamADna : teamBDna;
  const loserDna = predictedWinnerId === teamA.id ? teamBDna : teamADna;

  // No raw match history exists for modeled profiles, so head-to-head and
  // recent-form-window insights are omitted (generateInsights is already
  // null-safe for both) rather than fabricated.
  const insightInput = {
    winner,
    loser,
    winnerDna,
    loserDna,
    matchDna,
    confidence,
    trustScore,
    headToHead: null,
    winnerRecentForm: null,
    loserRecentForm: null,
    dimensionAgreement,
    formStability,
    featureCoverage: VCT_FEATURE_COVERAGE,
  };
  const keyFactors = generateKeyFactors(insightInput);
  const rawInsights = generateInsights(insightInput, keyFactors);

  // generateInsights' trust-score-explanation sentence assumes coverage was
  // measured "from the normalized match history", which doesn't apply to
  // modeled profiles — swapped for an accurate equivalent instead of left
  // misleading. Every other insight/key factor is reused unmodified.
  const insights = rawInsights.map((insight) =>
    insight.id === "trust-score-explanation"
      ? {
          ...insight,
          description: `Trust Score sits at ${trustScore}% because both teams have complete modeled Team DNA coverage, combined with this prediction's ${confidence}% confidence.`,
        }
      : insight,
  );

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
    warnings: [VCT_PROFILE_DISCLOSURE],
    generatedAt: new Date().toISOString(),
    predictionVersion: "vct-engine-0.1",
  };
}

/**
 * Same cache (`cache.ts`) as `generatePrediction`, safely shared: cache keys
 * are derived only from scenario fields, and TASK-031's `VctTeamId` strings
 * (e.g. "paper-rex") never collide with the original roster's ids (e.g. "prx").
 */
export function generateVctPrediction(request: PredictionRequest, teamA: Team, teamB: Team): PredictionResult {
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

  const result = computeVctPrediction(request, teamA, teamB);
  setCached(key, result);
  return result;
}
