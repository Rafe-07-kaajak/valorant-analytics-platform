export type FactorImpact = "positive" | "negative";

export interface KeyFactor {
  id: string;
  label: string;
  impact: FactorImpact;
  magnitude: number;
  description: string;
}

export type InsightKind = "advantage" | "weakness" | "deciding-factor" | "confidence";

export interface Insight {
  id: string;
  kind: InsightKind;
  title: string;
  description: string;
}

export interface PipelineStage {
  id: string;
  label: string;
  description: string;
  /** Real measured duration in milliseconds, or `null` when this stage's timing isn't separately measured — never a fabricated estimate. The synthetic engine always supplies a real measured number here; only Real Model 2.0's stages are ever `null`. */
  durationMs: number | null;
}
