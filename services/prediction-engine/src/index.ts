export { generatePrediction } from "./generatePrediction";
export { validateScenario } from "./validateScenario";
export { teams } from "./data/teams";
export { maps } from "./data/maps";
export { syntheticMatchHistory } from "./data/matchHistory";
export type { RawMatchRecord, RawTeamMatchStats } from "./data/matchHistory";
export { getFeatureRegistry } from "./lib/featureRegistry";
export type { FeatureRegistryEntry, FeatureStatus } from "./lib/featureRegistry";

// TASK-031 — synthetic 32-team profile layer. Kept separate from the
// 8-team synthetic dataset above, which still powers the live Prediction
// Studio flow; see services/prediction-engine/src/lib/vctTeamProfiles.ts.
export { VCT_TEAM_IDENTITIES } from "./data/vctTeams";
export type { VctTeamId, VctRegionId, VctTeamIdentity } from "./data/vctTeams";
export {
  VCT_TEAM_PROFILES,
  VCT_PROFILE_DISCLOSURE,
  generateVctTeamProfiles,
  getVctTeamProfile,
  getVctTeamProfilesByRegion,
  getVctMapStrength,
  getStrongestVctMap,
  getWeakestVctMap,
} from "./lib/vctTeamProfiles";
export type { VctTeamProfile, VctArchetype, VctMapStrengthEntry } from "./lib/vctTeamProfiles";
export { previewVctMatchup } from "./lib/vctMatchupPreview";
export type { VctMatchupPreview } from "./lib/vctMatchupPreview";
export { validateVctTeamProfiles } from "./lib/validateVctTeamProfiles";
export type { VctTeamProfileValidationIssue } from "./lib/validateVctTeamProfiles";

// TASK-032 — wires the 32-team profile layer into a request/response path
// compatible with the existing PredictionRequest/PredictionResult contracts.
export { generateVctPrediction } from "./generateVctPrediction";
export { validateVctScenario } from "./validateVctScenario";

// TASK-038 — isolated What-if Simulator path. Additive: the production
// prediction path above is untouched by these exports.
export { simulateVctPrediction } from "./simulateVctPrediction";
export { validateSimulationRequest } from "./validateSimulationRequest";
export { getVctProfileBaseline } from "./lib/vctProfileBaseline";
