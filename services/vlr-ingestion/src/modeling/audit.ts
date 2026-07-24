import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";
import type { FeatureRow } from "../feature/types";
import type { FeaturePolicy } from "./featurePolicy";
import { readRawField } from "./featurePolicy";
import type { SplitAssignment, SplitLabel } from "../feature/splits";
import { fitClassPrior } from "./baselines";
import { resolveSafePath } from "../persistence/pathSafety";
import { stableStringify } from "../curate/curatedExport";

/**
 * Model feasibility audit — TASK-045 requirement 2. A deterministic,
 * read-only report over the TASK-044 feature dataset, produced before any
 * training happens. Every statistic here is a plain descriptive
 * computation; nothing in this module fits a model or writes to
 * `features/`.
 */

function countBy<T extends string | number>(values: readonly T[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const v of values) counts[String(v)] = (counts[String(v)] ?? 0) + 1;
  return counts;
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length;
}

function pearsonCorrelation(a: readonly number[], b: readonly number[]): number {
  const n = a.length;
  if (n === 0) return 0;
  const meanA = mean(a);
  const meanB = mean(b);
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i += 1) {
    const da = a[i]! - meanA;
    const db = b[i]! - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA === 0 || varB === 0) return 0;
  return cov / Math.sqrt(varA * varB);
}

export interface MissingnessEntry {
  readonly field: string;
  readonly missingCount: number;
  readonly missingRate: number;
}

export interface ConstantFeatureEntry {
  readonly field: string;
  readonly value: string;
}

export interface NearConstantFeatureEntry {
  readonly field: string;
  readonly dominantValue: string;
  readonly dominantRate: number;
}

export interface DuplicateFeaturePair {
  readonly fieldA: string;
  readonly fieldB: string;
}

export interface CorrelatedFeaturePair {
  readonly fieldA: string;
  readonly fieldB: string;
  readonly correlation: number;
}

export interface TargetCorrelationEntry {
  readonly field: string;
  readonly correlation: number;
}

export interface SplitShiftEntry {
  readonly field: string;
  readonly trainMean: number;
  readonly validationMean: number;
  readonly testMean: number;
}

export interface ModelAudit {
  readonly generatedAt: string;
  readonly rowCount: number;
  readonly dateRangeStartIso: string | null;
  readonly dateRangeEndIso: string | null;
  readonly splitCounts: Record<SplitLabel, number>;
  readonly eventFamilyDistribution: Record<string, number>;
  readonly yearDistribution: Record<string, number>;
  readonly teamCoverageCount: number;
  readonly coldStartRowCount: number;
  readonly featureCount: number;
  readonly numericFeatureCount: number;
  readonly booleanFeatureCount: number;
  readonly categoricalFeatureCount: number;
  readonly missingness: readonly MissingnessEntry[];
  readonly constantFeatures: readonly ConstantFeatureEntry[];
  readonly nearConstantFeatures: readonly NearConstantFeatureEntry[];
  readonly duplicateFeaturePairs: readonly DuplicateFeaturePair[];
  readonly highlyCorrelatedNumericPairs: readonly CorrelatedFeaturePair[];
  readonly suspiciousTargetCorrelations: readonly TargetCorrelationEntry[];
  readonly splitDistributionShift: readonly SplitShiftEntry[];
  readonly targets: {
    readonly teamAWinCount: number;
    readonly teamBWinCount: number;
    readonly overallTeamAWinRate: number;
    readonly byEventFamily: Record<string, { readonly teamAWinRate: number; readonly count: number }>;
    readonly bySplit: Record<SplitLabel, { readonly teamAWinRate: number; readonly count: number }>;
    readonly orientationBiasFlag: boolean;
  };
  readonly baselineProbabilities: {
    readonly constant: number;
    readonly trainingSetClassPrior: number;
    readonly meanEloWinProbability: number;
  };
  readonly excludedFields: readonly string[];
}

const NEAR_CONSTANT_THRESHOLD = 0.99;
const HIGH_CORRELATION_THRESHOLD = 0.95;
const SUSPICIOUS_TARGET_CORRELATION_THRESHOLD = 0.9;
const ORIENTATION_BIAS_THRESHOLD = 0.1;

export function buildModelFeasibilityAudit(rows: readonly FeatureRow[], policy: FeaturePolicy, splitAssignments: readonly SplitAssignment[], generatedAt: string): ModelAudit {
  const splitByMatch = new Map(splitAssignments.map((a) => [a.matchInternalId, a.split]));
  const splitOf = (row: FeatureRow): SplitLabel => splitByMatch.get(row.matchInternalId) ?? "train";

  const sortedByTime = [...rows].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const dateRangeStartIso = sortedByTime[0]?.scheduledAt ?? null;
  const dateRangeEndIso = sortedByTime[sortedByTime.length - 1]?.scheduledAt ?? null;

  const splitCounts: Record<SplitLabel, number> = { train: 0, validation: 0, test: 0, excluded: 0 };
  for (const row of rows) splitCounts[splitOf(row)] += 1;

  const eventFamilyDistribution = countBy(rows.map((r) => r.eventFamily));
  const yearDistribution = countBy(rows.map((r) => r.seasonYear));

  const teamIds = new Set<string>();
  for (const row of rows) {
    teamIds.add(row.teamAProviderId);
    teamIds.add(row.teamBProviderId);
  }

  const coldStartRowCount = rows.filter((r) => r.teamAIsColdStart || r.teamBIsColdStart).length;

  // Missingness (nullable numeric fields only — every other field is validated non-missing by TASK-044).
  const missingness: MissingnessEntry[] = policy.numericFields
    .map((field) => {
      const missingCount = rows.filter((row) => readRawField(row, field) === null).length;
      return { field, missingCount, missingRate: rows.length > 0 ? missingCount / rows.length : 0 };
    })
    .filter((entry) => entry.missingCount > 0)
    .sort((a, b) => b.missingRate - a.missingRate);

  // Constant / near-constant features across every candidate input field.
  const constantFeatures: ConstantFeatureEntry[] = [];
  const nearConstantFeatures: NearConstantFeatureEntry[] = [];
  for (const field of policy.allInputFields) {
    const values = rows.map((row) => String(readRawField(row, field)));
    const counts = countBy(values);
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const [dominantValue, dominantCount] = entries[0]!;
    const dominantRate = dominantCount / rows.length;
    if (entries.length === 1) constantFeatures.push({ field, value: dominantValue });
    else if (dominantRate >= NEAR_CONSTANT_THRESHOLD) nearConstantFeatures.push({ field, dominantValue, dominantRate });
  }

  // Duplicate features: identical value sequences across the full row set.
  const duplicateFeaturePairs: DuplicateFeaturePair[] = [];
  const serialized = new Map<string, string>();
  for (const field of policy.allInputFields) {
    const key = rows.map((row) => String(readRawField(row, field))).join("|");
    const existing = serialized.get(key);
    if (existing) duplicateFeaturePairs.push({ fieldA: existing, fieldB: field });
    else serialized.set(key, field);
  }

  // Highly correlated numeric pairs.
  const numericSeries = new Map<string, number[]>();
  for (const field of policy.numericFields) {
    numericSeries.set(
      field,
      rows.map((row) => {
        const raw = readRawField(row, field);
        return raw === null ? 0 : (raw as number);
      }),
    );
  }
  const highlyCorrelatedNumericPairs: CorrelatedFeaturePair[] = [];
  for (let i = 0; i < policy.numericFields.length; i += 1) {
    for (let j = i + 1; j < policy.numericFields.length; j += 1) {
      const fieldA = policy.numericFields[i]!;
      const fieldB = policy.numericFields[j]!;
      const correlation = pearsonCorrelation(numericSeries.get(fieldA)!, numericSeries.get(fieldB)!);
      if (Math.abs(correlation) >= HIGH_CORRELATION_THRESHOLD) highlyCorrelatedNumericPairs.push({ fieldA, fieldB, correlation });
    }
  }

  // Suspicious target correlation — a numeric input near-perfectly tracking the label is a leakage smell.
  const labels = rows.map((r) => r.labelTeamAWin);
  const suspiciousTargetCorrelations: TargetCorrelationEntry[] = policy.numericFields
    .map((field) => ({ field, correlation: pearsonCorrelation(numericSeries.get(field)!, labels) }))
    .filter((entry) => Math.abs(entry.correlation) >= SUSPICIOUS_TARGET_CORRELATION_THRESHOLD);

  // Train/validation/test distribution shift for a representative sample of numeric fields (Elo + form + rest).
  const shiftFields = ["teamAEloRating", "teamACumulativeWinRate", "teamALast10WinRate", "teamAAvgOpponentEloLast10"].filter((f) => policy.numericFields.includes(f));
  const splitDistributionShift: SplitShiftEntry[] = shiftFields.map((field) => {
    const byField = numericSeries.get(field)!;
    const trainValues: number[] = [];
    const validationValues: number[] = [];
    const testValues: number[] = [];
    rows.forEach((row, i) => {
      const split = splitOf(row);
      if (split === "train") trainValues.push(byField[i]!);
      else if (split === "validation") validationValues.push(byField[i]!);
      else if (split === "test") testValues.push(byField[i]!);
    });
    return { field, trainMean: mean(trainValues), validationMean: mean(validationValues), testMean: mean(testValues) };
  });

  const teamAWinCount: number = labels.reduce((s: number, y) => s + y, 0);
  const teamBWinCount = rows.length - teamAWinCount;
  const overallTeamAWinRate = rows.length > 0 ? teamAWinCount / rows.length : 0;

  const byEventFamily: Record<string, { teamAWinRate: number; count: number }> = {};
  for (const family of new Set(rows.map((r) => r.eventFamily))) {
    const familyRows = rows.filter((r) => r.eventFamily === family);
    byEventFamily[family] = { teamAWinRate: mean(familyRows.map((r) => r.labelTeamAWin)), count: familyRows.length };
  }

  const bySplit: Record<SplitLabel, { teamAWinRate: number; count: number }> = {
    train: { teamAWinRate: 0, count: 0 },
    validation: { teamAWinRate: 0, count: 0 },
    test: { teamAWinRate: 0, count: 0 },
    excluded: { teamAWinRate: 0, count: 0 },
  };
  for (const split of ["train", "validation", "test", "excluded"] as const) {
    const splitRows = rows.filter((r) => splitOf(r) === split);
    bySplit[split] = { teamAWinRate: mean(splitRows.map((r) => r.labelTeamAWin)), count: splitRows.length };
  }

  const trainingRows = rows.filter((r) => splitOf(r) === "train");
  const meanEloWinProbability = mean(rows.map((r) => r.teamAEloWinProbability));

  return {
    generatedAt,
    rowCount: rows.length,
    dateRangeStartIso,
    dateRangeEndIso,
    splitCounts,
    eventFamilyDistribution,
    yearDistribution,
    teamCoverageCount: teamIds.size,
    coldStartRowCount,
    featureCount: policy.allInputFields.length,
    numericFeatureCount: policy.numericFields.length,
    booleanFeatureCount: policy.booleanFields.length,
    categoricalFeatureCount: policy.categoricalFields.length,
    missingness,
    constantFeatures,
    nearConstantFeatures,
    duplicateFeaturePairs,
    highlyCorrelatedNumericPairs,
    suspiciousTargetCorrelations,
    splitDistributionShift,
    targets: {
      teamAWinCount,
      teamBWinCount,
      overallTeamAWinRate,
      byEventFamily,
      bySplit,
      orientationBiasFlag: Math.abs(overallTeamAWinRate - 0.5) >= ORIENTATION_BIAS_THRESHOLD,
    },
    baselineProbabilities: {
      constant: 0.5,
      trainingSetClassPrior: fitClassPrior(trainingRows),
      meanEloWinProbability,
    },
    excludedFields: policy.excludedFields,
  };
}

/** Persists the audit as a single generated file — TASK-045 requirement 2 ("Persist this as a generated local audit report"). Written to `<dataDir>/models/model-audit.json`, sibling to (but not part of) the versioned `selected-model/` artifact bundle. */
export async function writeModelAuditReport(dataDir: string, audit: ModelAudit): Promise<void> {
  const path = resolveSafePath(dataDir, "models", "model-audit.json");
  await mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.tmp-${randomBytes(6).toString("hex")}`;
  await writeFile(tempPath, stableStringify(audit), "utf-8");
  await rename(tempPath, path);
}
