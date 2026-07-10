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
  durationMs: number;
}
