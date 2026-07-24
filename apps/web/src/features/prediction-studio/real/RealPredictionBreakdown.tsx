"use client";

import type { CurrentPredictionResponse } from "@repo/shared";
import { Card, Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui";
import type { RealBreakdownController } from "./useRealBreakdownState";
import { RealModelContributionsTab } from "./RealModelContributionsTab";
import { RealTeamStateTab } from "./RealTeamStateTab";
import { RealKeyFactorsTab } from "./RealKeyFactorsTab";
import { RealPipelineTab } from "./RealPipelineTab";

export interface RealPredictionBreakdownProps {
  result: CurrentPredictionResponse;
  teamAName: string;
  teamBName: string;
  breakdown: RealBreakdownController;
}

/**
 * Real Model equivalent of the synthetic Interactive Prediction Breakdown
 * (`breakdown/InteractivePredictionBreakdown.tsx`) — same four-tab shape and
 * shared `Tabs` primitive, but every tab is a real-data equivalent: Model
 * Contributions (the estimator's one actual driver), Team State (real Elo/
 * form/opponent-adjusted/map/schedule/momentum), Key Factors (driver vs.
 * supporting context, kept visually separate), and Real Pipeline (actual
 * stages, real timings where measured).
 */
export function RealPredictionBreakdown({ result, teamAName, teamBName, breakdown }: RealPredictionBreakdownProps) {
  return (
    <Card className="flex flex-col gap-md">
      <h3>Real Prediction Breakdown</h3>
      <p className="text-sm text-muted-foreground">
        Explore how this real-data prediction was built. Nothing here changes the prediction itself; it&apos;s
        the same result, viewed from four angles.
      </p>

      <Tabs defaultValue="model-contributions">
        <div className="overflow-x-auto">
          <TabsList aria-label="Real prediction breakdown views">
            <TabsTrigger value="model-contributions">Model Contributions</TabsTrigger>
            <TabsTrigger value="team-state">Team State</TabsTrigger>
            <TabsTrigger value="key-factors">Key Factors</TabsTrigger>
            <TabsTrigger value="pipeline">Real Pipeline</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="model-contributions" className="pt-md">
          <RealModelContributionsTab result={result} teamAName={teamAName} teamBName={teamBName} />
        </TabsContent>

        <TabsContent value="team-state" className="pt-md">
          <RealTeamStateTab result={result} teamAName={teamAName} teamBName={teamBName} breakdown={breakdown} />
        </TabsContent>

        <TabsContent value="key-factors" className="pt-md">
          <RealKeyFactorsTab result={result} teamAName={teamAName} teamBName={teamBName} breakdown={breakdown} />
        </TabsContent>

        <TabsContent value="pipeline" className="pt-md">
          <RealPipelineTab stages={result.pipeline} breakdown={breakdown} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
