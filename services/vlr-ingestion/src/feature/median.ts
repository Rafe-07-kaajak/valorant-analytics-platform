/**
 * Running median tracker used by the opponent-strength feature group
 * (TASK-044 requirement 7) to classify a historical opponent as "above" or
 * "below" the league's observed rating median at the time the reference is
 * taken. Leakage-safe by construction: callers only ever read the median
 * after pushing every observation strictly before the current match group,
 * never an observation from the current or a future group.
 */
export class RunningMedianTracker {
  private readonly values: number[] = [];

  push(value: number): void {
    this.values.push(value);
  }

  /** Returns the median of every value observed so far, or `fallback` if nothing has been observed yet. */
  median(fallback: number): number {
    if (this.values.length === 0) return fallback;
    const sorted = [...this.values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
  }
}
