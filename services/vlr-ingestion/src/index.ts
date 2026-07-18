// Environment and safety
export { loadVlrIngestionConfig, describeConfig } from "./env";
export type { VlrIngestionConfig } from "./env";
export { IngestionError, exitCodeForError, isRetryableCode } from "./errors";
export type { IngestionErrorCode } from "./errors";

// Backfill scope
export { buildCanonicalTargetScope, validateBackfillScope, serializeBackfillScope, BACKFILL_REGIONS, TOURNAMENT_LEVELS } from "./scope/backfillScope";
export type { BackfillScope, BackfillRegion, TournamentLevel, MatchStatusFilter, ScopeValidationResult } from "./scope/backfillScope";

// Event classification
export { APPROVED_EVENT_FAMILIES, EXCLUDED_EVENT_CATEGORIES, isApprovedEventFamily } from "./classification/eventFamily";
export type { ApprovedEventFamily, ExcludedEventCategory, EventClassification, EventClassificationResult } from "./classification/eventFamily";
export { classifyEvent } from "./classification/eventClassification";
export type { ClassifiableEventInput } from "./classification/eventClassification";
export { validateOverrideRegistry, buildOverrideLookup, INITIAL_EVENT_CLASSIFICATION_OVERRIDES } from "./classification/eventOverrides";
export type { EventClassificationOverride } from "./classification/eventOverrides";

// Identity
export { buildVlrSourceReference, parseVlrSourceReference, deterministicInternalId } from "./identity/deterministicId";
export { validateTeamMappingRegistry, buildTeamMappingLookup, resolveTeamIdentity, findAliasCandidates, INITIAL_TEAM_MAPPING_REGISTRY } from "./identity/teamMapping";
export type { VlrTeamMappingEntry, ResolvedTeamIdentity } from "./identity/teamMapping";

// Provider abstraction
export type { EsportsDataProvider } from "./provider/types";

// VLR HTTP + parsing
export { VlrHttpClient } from "./vlr/httpClient";
export { buildTeamUrl, buildEventUrl, buildMatchUrl, buildEventListUrl, buildEventMatchesUrl, isValidVlrId, assertApprovedUrl } from "./vlr/urlBuilder";
export { parseTeamPage } from "./vlr/parsers/teamParser";
export { parseEventPage } from "./vlr/parsers/eventParser";
export { parseEventDiscoveryPage } from "./vlr/parsers/eventDiscoveryParser";
export { parseMatchListPage } from "./vlr/parsers/matchListParser";
export { parseMatchDetailPage } from "./vlr/parsers/matchDetailParser";

// Normalization
export { evaluateTrainingEligibility } from "./normalize/trainingEligibility";
export type { TrainingEligibilityInput, TrainingEligibilityResult } from "./normalize/trainingEligibility";
export { normalizeTeam } from "./normalize/normalizeTeam";
export { normalizeEvent, deriveTournamentLevel } from "./normalize/normalizeEvent";
export { normalizeMatch } from "./normalize/normalizeMatch";
export type { NormalizedMatch, NormalizedEvent, NormalizedTeam } from "./normalize/normalizedSchemas";

// Persistence
export { FilesystemIngestionStore } from "./persistence/filesystemStore";
export type { IngestionStore } from "./persistence/types";

// Ingestion coordinator
export { IngestionService } from "./ingestion/ingestionService";
export type { IngestionServiceDeps, RunOptions } from "./ingestion/ingestionService";
export { FixtureVlrProvider } from "./ingestion/fixtureProvider";
export type { RunSummary } from "./ingestion/runSummary";
