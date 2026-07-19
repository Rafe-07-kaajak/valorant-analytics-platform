import type { FeatureRow } from "../feature/types";
import { ModelingError } from "./errors";
import { readRawField, type FeaturePolicy } from "./featurePolicy";

/**
 * Preprocessing — TASK-045 requirement 6. Every statistic here (medians,
 * means/standard deviations, categorical vocabularies) is fit strictly from
 * the rows passed to `fitPreprocessor` (always a training fold, never
 * validation/test) and then applied unchanged by `transformRows`. Numeric
 * standardization is a per-feature affine transform, which is
 * order-preserving — it never changes which threshold a decision tree
 * would choose on that feature — so both the logistic-regression and
 * tree-model candidates share one preprocessing pipeline and one feature
 * contract rather than needing two divergent ones.
 */

const UNKNOWN_CATEGORY_TOKEN = "__unknown__";

export interface PreprocessorState {
  readonly numericFields: readonly string[];
  readonly nullableNumericFields: readonly string[];
  readonly booleanFields: readonly string[];
  readonly categoricalFields: readonly string[];
  readonly medianByField: Readonly<Record<string, number>>;
  readonly meanByField: Readonly<Record<string, number>>;
  readonly stdByField: Readonly<Record<string, number>>;
  readonly vocabularyByField: Readonly<Record<string, readonly string[]>>;
  readonly featureNames: readonly string[];
}

function numericValuesExcludingNulls(rows: readonly FeatureRow[], field: string): number[] {
  const values: number[] = [];
  for (const row of rows) {
    const raw = readRawField(row, field);
    if (raw !== null) values.push(raw as number);
  }
  return values;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function meanAndStd(values: readonly number[]): { mean: number; std: number } {
  if (values.length === 0) return { mean: 0, std: 1 };
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);
  // Constant-feature guard: a zero-variance field would otherwise divide by
  // zero. Standardizing with scale 1 leaves it as a (harmless) constant
  // column rather than producing NaN/Infinity.
  return { mean, std: std > 0 ? std : 1 };
}

/** Fits imputation medians, standardization parameters, and categorical vocabularies strictly from `trainRows`. */
export function fitPreprocessor(trainRows: readonly FeatureRow[], policy: FeaturePolicy): PreprocessorState {
  const medianByField: Record<string, number> = {};
  const meanByField: Record<string, number> = {};
  const stdByField: Record<string, number> = {};
  const nullableNumericFields: string[] = [];

  for (const field of policy.numericFields) {
    const nonNullValues = numericValuesExcludingNulls(trainRows, field);
    const hasNullInTrain = nonNullValues.length !== trainRows.length;
    if (hasNullInTrain) nullableNumericFields.push(field);
    const fieldMedian = median(nonNullValues);
    medianByField[field] = fieldMedian;
    const imputedValues = trainRows.map((row) => {
      const raw = readRawField(row, field);
      return raw === null ? fieldMedian : (raw as number);
    });
    const { mean, std } = meanAndStd(imputedValues);
    meanByField[field] = mean;
    stdByField[field] = std;
  }

  const vocabularyByField: Record<string, readonly string[]> = {};
  for (const field of policy.categoricalFields) {
    const distinct = new Set<string>();
    for (const row of trainRows) {
      const raw = readRawField(row, field);
      if (raw !== null) distinct.add(String(raw));
    }
    vocabularyByField[field] = [...distinct].sort();
  }

  const featureNames: string[] = [
    ...policy.numericFields,
    ...nullableNumericFields.map((f) => `${f}__isMissing`),
    ...policy.booleanFields,
    ...policy.categoricalFields.flatMap((f) => [...vocabularyByField[f]!.map((category) => `${f}=${category}`), `${f}=${UNKNOWN_CATEGORY_TOKEN}`]),
  ];

  return {
    numericFields: policy.numericFields,
    nullableNumericFields: nullableNumericFields.sort(),
    booleanFields: policy.booleanFields,
    categoricalFields: policy.categoricalFields,
    medianByField,
    meanByField,
    stdByField,
    vocabularyByField,
    featureNames,
  };
}

export interface TransformResult {
  readonly matrix: readonly (readonly number[])[];
  readonly featureNames: readonly string[];
}

/** Applies a previously-fit preprocessor to `rows` unchanged — never refits, never discovers new categories or statistics. */
export function transformRows(rows: readonly FeatureRow[], state: PreprocessorState): TransformResult {
  const matrix = rows.map((row) => transformSingleRow(row, state));
  return { matrix, featureNames: state.featureNames };
}

export function transformSingleRow(row: FeatureRow, state: PreprocessorState): readonly number[] {
  const values: number[] = [];

  for (const field of state.numericFields) {
    const raw = readRawField(row, field);
    const numericValue = raw === null ? state.medianByField[field]! : (raw as number);
    const mean = state.meanByField[field]!;
    const std = state.stdByField[field]!;
    const standardized = (numericValue - mean) / std;
    if (!Number.isFinite(standardized)) {
      throw new ModelingError("schema_validation_failed", `Non-finite standardized value for field "${field}" on row ${row.matchInternalId}.`);
    }
    values.push(standardized);
  }

  for (const field of state.nullableNumericFields) {
    const raw = readRawField(row, field);
    values.push(raw === null ? 1 : 0);
  }

  for (const field of state.booleanFields) {
    values.push(readRawField(row, field) === true ? 1 : 0);
  }

  for (const field of state.categoricalFields) {
    const raw = readRawField(row, field);
    const value = raw === null ? UNKNOWN_CATEGORY_TOKEN : String(raw);
    const vocabulary = state.vocabularyByField[field]!;
    for (const category of vocabulary) values.push(value === category ? 1 : 0);
    values.push(vocabulary.includes(value) ? 0 : 1);
  }

  return values;
}
