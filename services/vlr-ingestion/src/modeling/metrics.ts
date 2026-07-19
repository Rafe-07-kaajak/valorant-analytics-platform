/**
 * Probabilistic evaluation metrics — TASK-045 requirement 8. Every function
 * here is a pure, deterministic computation over already-produced
 * predictions; none of them fit anything or touch the filesystem, so they
 * are safe to reuse identically across candidate training, walk-forward
 * backtesting, and the single frozen final test evaluation.
 */

const DEFAULT_CLIP_EPSILON = 1e-15;

/** Clips a probability strictly inside `(epsilon, 1 - epsilon)` — TASK-045 requirement 9 ("clipped safely away from exactly 0 and 1 only where metric stability requires it"). */
export function clipProbability(p: number, epsilon: number = DEFAULT_CLIP_EPSILON): number {
  return Math.min(1 - epsilon, Math.max(epsilon, p));
}

function assertSameLength(yTrue: readonly number[], yPred: readonly number[]): void {
  if (yTrue.length !== yPred.length) {
    throw new Error(`yTrue (${yTrue.length}) and yPred (${yPred.length}) must have the same length.`);
  }
}

export function logLoss(yTrue: readonly number[], yPred: readonly number[]): number {
  assertSameLength(yTrue, yPred);
  if (yTrue.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < yTrue.length; i += 1) {
    const p = clipProbability(yPred[i]!);
    sum += yTrue[i]! === 1 ? -Math.log(p) : -Math.log(1 - p);
  }
  return sum / yTrue.length;
}

export function brierScore(yTrue: readonly number[], yPred: readonly number[]): number {
  assertSameLength(yTrue, yPred);
  if (yTrue.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < yTrue.length; i += 1) {
    const diff = yPred[i]! - yTrue[i]!;
    sum += diff * diff;
  }
  return sum / yTrue.length;
}

/** Rank-based ROC AUC (Mann-Whitney U form), with average ranks for ties. Returns `null` when only one class is present (AUC is undefined). */
export function rocAuc(yTrue: readonly number[], yPred: readonly number[]): number | null {
  assertSameLength(yTrue, yPred);
  const n = yTrue.length;
  const nPos = yTrue.filter((y) => y === 1).length;
  const nNeg = n - nPos;
  if (nPos === 0 || nNeg === 0) return null;

  const indices = Array.from({ length: n }, (_, i) => i).sort((a, b) => yPred[a]! - yPred[b]!);
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && yPred[indices[j + 1]!]! === yPred[indices[i]!]!) j += 1;
    const averageRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) ranks[indices[k]!] = averageRank;
    i = j + 1;
  }

  let sumRanksPositive = 0;
  for (let idx = 0; idx < n; idx += 1) if (yTrue[idx] === 1) sumRanksPositive += ranks[idx]!;

  const u = sumRanksPositive - (nPos * (nPos + 1)) / 2;
  return u / (nPos * nNeg);
}

export function accuracyAtThreshold(yTrue: readonly number[], yPred: readonly number[], threshold = 0.5): number {
  assertSameLength(yTrue, yPred);
  if (yTrue.length === 0) return 0;
  let correct = 0;
  for (let i = 0; i < yTrue.length; i += 1) {
    const predicted = yPred[i]! >= threshold ? 1 : 0;
    if (predicted === yTrue[i]) correct += 1;
  }
  return correct / yTrue.length;
}

export interface ConfusionCounts {
  readonly truePositive: number;
  readonly trueNegative: number;
  readonly falsePositive: number;
  readonly falseNegative: number;
}

export function confusionCounts(yTrue: readonly number[], yPred: readonly number[], threshold = 0.5): ConfusionCounts {
  assertSameLength(yTrue, yPred);
  let truePositive = 0;
  let trueNegative = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  for (let i = 0; i < yTrue.length; i += 1) {
    const predicted = yPred[i]! >= threshold ? 1 : 0;
    const actual = yTrue[i]!;
    if (predicted === 1 && actual === 1) truePositive += 1;
    else if (predicted === 0 && actual === 0) trueNegative += 1;
    else if (predicted === 1 && actual === 0) falsePositive += 1;
    else falseNegative += 1;
  }
  return { truePositive, trueNegative, falsePositive, falseNegative };
}

export function balancedAccuracy(yTrue: readonly number[], yPred: readonly number[], threshold = 0.5): number {
  const c = confusionCounts(yTrue, yPred, threshold);
  const sensitivity = c.truePositive + c.falseNegative > 0 ? c.truePositive / (c.truePositive + c.falseNegative) : 0;
  const specificity = c.trueNegative + c.falsePositive > 0 ? c.trueNegative / (c.trueNegative + c.falsePositive) : 0;
  return (sensitivity + specificity) / 2;
}

export interface PrecisionRecallF1 {
  readonly precision: number;
  readonly recall: number;
  readonly f1: number;
}

export function precisionRecallF1(yTrue: readonly number[], yPred: readonly number[], threshold = 0.5): PrecisionRecallF1 {
  const c = confusionCounts(yTrue, yPred, threshold);
  const precision = c.truePositive + c.falsePositive > 0 ? c.truePositive / (c.truePositive + c.falsePositive) : 0;
  const recall = c.truePositive + c.falseNegative > 0 ? c.truePositive / (c.truePositive + c.falseNegative) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision, recall, f1 };
}

export function averagePredictedProbability(yPred: readonly number[]): number {
  if (yPred.length === 0) return 0;
  return yPred.reduce((sum, p) => sum + p, 0) / yPred.length;
}

/** Mean absolute distance from 0.5 — a simple sharpness proxy (0 = always predicts the neutral prior, 0.5 = always maximally confident). */
export function predictionSharpness(yPred: readonly number[]): number {
  if (yPred.length === 0) return 0;
  return yPred.reduce((sum, p) => sum + Math.abs(p - 0.5), 0) / yPred.length;
}

export interface ReliabilityBin {
  readonly binStart: number;
  readonly binEnd: number;
  readonly count: number;
  readonly meanPredicted: number;
  readonly empiricalRate: number;
}

/** Equal-width reliability bins over `[0, 1]` — TASK-045 requirement 9 ("reliability-bin data"). Empty bins are still reported (count 0) so gaps in coverage are visible. */
export function reliabilityBins(yTrue: readonly number[], yPred: readonly number[], binCount = 10): readonly ReliabilityBin[] {
  assertSameLength(yTrue, yPred);
  const bins: { sumPredicted: number; sumActual: number; count: number }[] = Array.from({ length: binCount }, () => ({ sumPredicted: 0, sumActual: 0, count: 0 }));
  for (let i = 0; i < yPred.length; i += 1) {
    const p = Math.min(1, Math.max(0, yPred[i]!));
    const binIndex = Math.min(binCount - 1, Math.floor(p * binCount));
    bins[binIndex]!.sumPredicted += p;
    bins[binIndex]!.sumActual += yTrue[i]!;
    bins[binIndex]!.count += 1;
  }
  return bins.map((bin, index) => ({
    binStart: index / binCount,
    binEnd: (index + 1) / binCount,
    count: bin.count,
    meanPredicted: bin.count > 0 ? bin.sumPredicted / bin.count : 0,
    empiricalRate: bin.count > 0 ? bin.sumActual / bin.count : 0,
  }));
}

/** Expected calibration error: the count-weighted average absolute gap between each bin's mean predicted probability and its empirical positive rate. */
export function expectedCalibrationError(bins: readonly ReliabilityBin[]): number {
  const totalCount = bins.reduce((sum, bin) => sum + bin.count, 0);
  if (totalCount === 0) return 0;
  return bins.reduce((sum, bin) => sum + (bin.count / totalCount) * Math.abs(bin.meanPredicted - bin.empiricalRate), 0);
}

export interface CalibrationSlopeIntercept {
  readonly slope: number;
  readonly intercept: number;
  readonly binCountUsed: number;
}

/**
 * Ordinary-least-squares fit of empirical bin rate against mean predicted
 * probability, weighted by bin count. A slope near 1 and intercept near 0
 * indicate good calibration; this is a descriptive diagnostic over
 * reliability bins, not a hypothesis test, and is intentionally simple
 * given how few observations land in some bins at this dataset's size (see
 * docs/33, "Known limitations").
 */
export function calibrationSlopeIntercept(bins: readonly ReliabilityBin[]): CalibrationSlopeIntercept | null {
  const populated = bins.filter((bin) => bin.count > 0);
  if (populated.length < 2) return null;

  let sumWeight = 0;
  let sumWX = 0;
  let sumWY = 0;
  let sumWXX = 0;
  let sumWXY = 0;
  for (const bin of populated) {
    const w = bin.count;
    sumWeight += w;
    sumWX += w * bin.meanPredicted;
    sumWY += w * bin.empiricalRate;
    sumWXX += w * bin.meanPredicted * bin.meanPredicted;
    sumWXY += w * bin.meanPredicted * bin.empiricalRate;
  }
  const meanX = sumWX / sumWeight;
  const meanY = sumWY / sumWeight;
  const covXY = sumWXY / sumWeight - meanX * meanY;
  const varX = sumWXX / sumWeight - meanX * meanX;
  if (varX === 0) return null;
  const slope = covXY / varX;
  const intercept = meanY - slope * meanX;
  return { slope, intercept, binCountUsed: populated.length };
}

export interface ProbabilisticMetrics {
  readonly logLoss: number;
  readonly brierScore: number;
  readonly rocAuc: number | null;
  readonly accuracy: number;
  readonly balancedAccuracy: number;
  readonly precision: number;
  readonly recall: number;
  readonly f1: number;
  readonly expectedCalibrationError: number;
  readonly calibrationSlopeIntercept: CalibrationSlopeIntercept | null;
  readonly averagePredictedProbability: number;
  readonly predictionSharpness: number;
  readonly positiveRate: number;
  readonly sampleCount: number;
}

/** Computes every metric this task requires in one pass — the standard bundle reported for every candidate, fold, and the frozen final test evaluation. */
export function computeMetrics(yTrue: readonly number[], yPred: readonly number[], binCount = 10): ProbabilisticMetrics {
  const prf = precisionRecallF1(yTrue, yPred);
  const bins = reliabilityBins(yTrue, yPred, binCount);
  return {
    logLoss: logLoss(yTrue, yPred),
    brierScore: brierScore(yTrue, yPred),
    rocAuc: rocAuc(yTrue, yPred),
    accuracy: accuracyAtThreshold(yTrue, yPred),
    balancedAccuracy: balancedAccuracy(yTrue, yPred),
    precision: prf.precision,
    recall: prf.recall,
    f1: prf.f1,
    expectedCalibrationError: expectedCalibrationError(bins),
    calibrationSlopeIntercept: calibrationSlopeIntercept(bins),
    averagePredictedProbability: averagePredictedProbability(yPred),
    predictionSharpness: predictionSharpness(yPred),
    positiveRate: yTrue.length > 0 ? yTrue.reduce((sum, y) => sum + y, 0) / yTrue.length : 0,
    sampleCount: yTrue.length,
  };
}
