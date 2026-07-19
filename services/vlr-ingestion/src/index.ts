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
export { validateTeamMappingRegistry, buildTeamMappingLookup, resolveTeamIdentity, findAliasCandidates, effectiveMappingStatus, effectiveMappingConfidence, INITIAL_TEAM_MAPPING_REGISTRY } from "./identity/teamMapping";
export type { VlrTeamMappingEntry, ResolvedTeamIdentity, TeamMappingStatus, TeamIdentityEvidence } from "./identity/teamMapping";
export { validateTeamAliasRegistry, findCanonicalTeamsForAlias, normalizeAliasText, INITIAL_TEAM_ALIAS_REGISTRY } from "./identity/teamAliasRegistry";
export type { TeamAlias, TeamAliasType, TeamAliasCollision } from "./identity/teamAliasRegistry";
export { buildTeamLifecycleTimeline, detectRenames, detectSharedDisplayNames } from "./identity/teamLifecycle";
export type { TeamNameObservation, TeamLifecyclePeriod, RenameEvidence } from "./identity/teamLifecycle";
export { resolvePlayerIdentity, buildPlayerHandleHistory, detectDuplicateHandles, isMissingPlayerId } from "./identity/playerIdentity";
export type { ProviderPlayerIdentity, CanonicalPlayerIdentity, PlayerHandleObservation, PlayerAlias, PlayerIdentityConflict } from "./identity/playerIdentity";
export { buildTeamAudit, buildPlayerAudit, buildEventAudit } from "./identity/identityAudit";
export type { TeamAudit, TeamAuditEntry, PlayerAudit, PlayerAuditEntry, EventAudit, EventAuditEntry } from "./identity/identityAudit";

// Data quality (TASK-043)
export { createQualityIssue, mergeQualityIssues, sortQualityIssues, summarizeQualityIssues, defaultSeverityForCode } from "./quality/qualityIssue";
export type { QualityIssue, QualityIssueCode, QualityIssueSeverity, QualityIssueEntityType, QualityIssueSummary } from "./quality/qualityIssue";
export { QUALITY_RULES_VERSION } from "./quality/qualityRulesVersion";
export { computeRosterCompletenessScore, auditMatchRosters, buildPlayerTeamAppearanceTimeline } from "./quality/rosterQuality";
export type { RosterCompletenessScore, PlayerTeamAppearance } from "./quality/rosterQuality";
export { isUnplayedMapPlaceholder, auditMatchMaps } from "./quality/mapHardening";
export { auditMatchScoreConsistency } from "./quality/scoreConsistency";
export { auditMatchTimestamp } from "./quality/timestampHardening";
export { detectDuplicateMatchCandidates } from "./quality/duplicateDetection";
export type { DuplicateMatchCandidate, DuplicateClassification } from "./quality/duplicateDetection";
export { evaluateQuarantine, buildQuarantineRecord } from "./quality/quarantine";
export type { QuarantineRecord, QuarantineEvaluation } from "./quality/quarantine";
export { evaluateHardenedTrainingEligibility } from "./quality/trainingEligibilityHardened";
export type { HardenedEligibilityResult, HardenedIneligibilityReason } from "./quality/trainingEligibilityHardened";
export { runQualityAudit } from "./quality/qualityAudit";
export type { QualityAuditResult, MatchAuditSummary } from "./quality/qualityAudit";

// Reconciliation (TASK-043)
export { reconcileEvents } from "./reconciliation/eventReconciliation";
export { reconcileMatches } from "./reconciliation/matchReconciliation";
export { runFullReconciliation } from "./reconciliation/runReconciliation";
export { countByCategory, buildCategoryByExternalId } from "./reconciliation/reconciliationTypes";
export type { ReconciliationCategory, ReconciliationEntry, ReconciliationReport } from "./reconciliation/reconciliationTypes";

// Curated dataset export (TASK-043)
export { buildCuratedDataset, writeCuratedDataset, stableStringify } from "./curate/curatedExport";
export type { CuratedDatasetFiles, CuratedDatasetManifest, CuratedExportInput } from "./curate/curatedExport";
export { computeCuratedDatasetVersion, computeIdentityMappingVersion } from "./curate/curatedVersion";

// Mapping import (TASK-043)
export { validateTeamMappingImport, loadTeamMappingImportFile, safeJsonParse } from "./mapping/mappingImport";
export type { TeamMappingImportReport } from "./mapping/mappingImport";

// Dataset loading (TASK-043)
export { loadNormalizedDataset } from "./discovery/loadNormalizedDataset";
export type { NormalizedDataset } from "./discovery/loadNormalizedDataset";

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
export { resolveSafePath, safeFileName } from "./persistence/pathSafety";

// Ingestion coordinator
export { IngestionService } from "./ingestion/ingestionService";
export type { IngestionServiceDeps, RunOptions } from "./ingestion/ingestionService";
export { FixtureVlrProvider } from "./ingestion/fixtureProvider";
export type { RunSummary } from "./ingestion/runSummary";

// Real (live) VLR provider — TASK-042
export { RealVlrProvider } from "./vlr/realVlrProvider";
export type { RealVlrProviderProgress } from "./vlr/realVlrProvider";

// Historical discovery and backfill — TASK-042
export { buildEventDiscoveryManifest, discoverEventsResumable, saveEventDiscoveryManifest, loadEventDiscoveryManifest } from "./discovery/eventManifest";
export type { EventManifestEntry, EventDiscoveryManifest, ResumableDiscoveryProvider, DiscoverEventsResumableOptions, DiscoverEventsResumableResult } from "./discovery/eventManifest";
export { buildMatchDiscoveryManifest, buildMatchDiscoveryManifestResumable, saveMatchDiscoveryManifest, loadMatchDiscoveryManifest } from "./discovery/matchManifest";
export type { MatchManifestEntry, MatchDiscoveryManifest, ResumableMatchDiscoveryProvider } from "./discovery/matchManifest";
export { buildPreBackfillReport, formatPreBackfillReport } from "./discovery/preBackfillReport";
export type { PreBackfillReport } from "./discovery/preBackfillReport";
export { runBackfillBatch, runRetryBatch } from "./ingestion/backfillRunner";
export type { BackfillRunnerDeps, BackfillBatchResult } from "./ingestion/backfillRunner";
export { buildQualityReport, formatQualityReport } from "./discovery/qualityReport";
export type { QualityReport } from "./discovery/qualityReport";
export { validateCompleteness } from "./discovery/completenessValidation";
export type { CompletenessValidationResult } from "./discovery/completenessValidation";
export { buildDatasetManifest, saveDatasetManifest, loadDatasetManifest } from "./discovery/datasetManifest";
export type { DatasetManifest } from "./discovery/datasetManifest";

// Model artifact + offline inference (TASK-045) — reused as-is by TASK-046's
// production inference service so model math (Elo/logistic/tree/calibration)
// is never duplicated outside this package.
export { loadModelArtifactForInference, readArtifactFile, writeModelArtifact, MODEL_DIR_SEGMENTS } from "./modeling/artifact";
export type { LoadedModelArtifact, FeatureContract, ModelManifest, ModelCard, SerializedEstimator, ModelArtifactFiles, EvaluationReport, ReliabilityData, FeatureImportanceReport, RowPrediction, FoldPredictionRecord } from "./modeling/artifact";
export { predict } from "./modeling/inference";
export type { ModelInputRow, PredictionOutput } from "./modeling/inference";
export { ModelingError, exitCodeForModelingError } from "./modeling/errors";
export type { ModelingErrorCode } from "./modeling/errors";
export { computeModelVersion, contentHashOf, MODELING_RULES_VERSION } from "./modeling/modelVersion";
