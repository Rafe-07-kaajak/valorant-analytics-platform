"use client";

import { useCallback, useEffect, useState } from "react";
import type { GameMap, PredictionResult, Team, VctProfileBaselineResponse } from "@repo/shared";
import { Card, Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui";
import { useSimulatorState } from "./useSimulatorState";
import { ControlsTab } from "./ControlsTab";
import { ResultComparisonTab } from "./ResultComparisonTab";
import { ChangeBreakdownTab } from "./ChangeBreakdownTab";
import { getVctProfileBaseline } from "../../../lib/api/getVctProfileBaseline";
import { simulatePrediction } from "../../../lib/api/simulatePrediction";
import { toProfileAdjustment } from "../../../lib/whatIfSimulator";

export interface WhatIfSimulatorProps {
  result: PredictionResult;
  teamA: Team;
  teamB: Team;
  maps: GameMap[];
}

type BaselineFetchStatus = "loading" | "success" | "error";

/**
 * TASK-038. A pure scenario-analysis tool layered over the already-computed
 * baseline `result` — nothing here ever mutates `result` or the source team
 * profiles. The parent (`PredictionResultExperience`) mounts this component
 * with a `key` derived from the scenario's identity, so a genuinely new
 * scenario remounts it (fresh drafts, fresh baseline fetch) while switching
 * TASK-037's breakdown tabs — which never changes the scenario — leaves it
 * untouched. Because of that remount-on-scenario-change guarantee,
 * `teamA`/`teamB`/`result.scenario.mapIds` are effectively constant for this
 * component's entire mounted lifetime.
 */
export function WhatIfSimulator({ result, teamA, teamB, maps }: WhatIfSimulatorProps) {
  const mapIds = result.scenario.mapIds;
  const controller = useSimulatorState(mapIds);
  const [baseline, setBaseline] = useState<VctProfileBaselineResponse | null>(null);
  const [baselineStatus, setBaselineStatus] = useState<BaselineFetchStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    getVctProfileBaseline({ teamAId: teamA.id, teamBId: teamB.id, mapIds })
      .then((response) => {
        if (cancelled) return;
        setBaseline(response);
        setBaselineStatus("success");
      })
      .catch(() => {
        if (!cancelled) setBaselineStatus("error");
      });

    return () => {
      cancelled = true;
    };
    // One-time fetch on mount: this component remounts via a scenario-keyed
    // `key` whenever teamA/teamB/mapIds would actually change, so there is no
    // stale-closure risk in intentionally running this only once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mapLabel = useCallback((mapId: string) => maps.find((map) => map.id === mapId)?.name ?? mapId, [maps]);

  const runSimulation = useCallback(async () => {
    if (controller.status === "loading" || !controller.hasAdjustments) return;

    controller.simulateStart();
    try {
      const response = await simulatePrediction({
        requestId: crypto.randomUUID(),
        scenario: result.scenario,
        teamAAdjustment: toProfileAdjustment(controller.teamADraft, controller.mapADraft),
        teamBAdjustment: toProfileAdjustment(controller.teamBDraft, controller.mapBDraft),
      });
      controller.simulateSuccess(response);
    } catch (err) {
      controller.simulateError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }, [controller, result.scenario]);

  return (
    <Card className="flex flex-col gap-md">
      <h3>What-if Simulator</h3>
      <p className="text-sm text-muted-foreground">
        Explore hypothetical profile adjustments and see how they would change this matchup&apos;s modeled
        prediction. This is a scenario-analysis tool, not a forecast of real roster changes.
      </p>

      {baselineStatus === "error" ? (
        <p role="alert" className="text-sm text-danger">
          Unable to load baseline attribute values for this matchup, so the simulator can&apos;t render its
          controls right now.
        </p>
      ) : baselineStatus === "loading" || !baseline ? (
        <p className="text-sm text-muted-foreground">Loading simulator controls…</p>
      ) : (
        <Tabs defaultValue="controls">
          <div className="overflow-x-auto">
            <TabsList aria-label="What-if simulator views">
              <TabsTrigger value="controls">Controls</TabsTrigger>
              <TabsTrigger value="comparison">Result Comparison</TabsTrigger>
              <TabsTrigger value="breakdown">Change Breakdown</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="controls" className="pt-md">
            <ControlsTab
              teamAName={teamA.name}
              teamBName={teamB.name}
              teamABaseline={baseline.teamA}
              teamBBaseline={baseline.teamB}
              mapIds={mapIds}
              mapLabel={mapLabel}
              controller={controller}
              onRunSimulation={runSimulation}
            />
          </TabsContent>

          <TabsContent value="comparison" className="pt-md">
            <ResultComparisonTab baseline={result} teamAName={teamA.name} teamBName={teamB.name} controller={controller} />
          </TabsContent>

          <TabsContent value="breakdown" className="pt-md">
            <ChangeBreakdownTab
              baseline={result}
              teamAId={teamA.id}
              teamAName={teamA.name}
              teamBName={teamB.name}
              mapLabel={mapLabel}
              controller={controller}
            />
          </TabsContent>
        </Tabs>
      )}
    </Card>
  );
}
