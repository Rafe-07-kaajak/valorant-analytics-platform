"use client";

import { useCallback, useEffect, useState } from "react";
import type { GameMap, PredictionResult, SimulationResult, Team, VctProfileAdjustment, VctProfileBaselineResponse } from "@repo/shared";
import { Card, Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui";
import { useSimulatorState } from "./useSimulatorState";
import { ControlsTab, type ControlsTabProps } from "./ControlsTab";
import { ResultComparisonTab } from "./ResultComparisonTab";
import { ChangeBreakdownTab } from "./ChangeBreakdownTab";
import { getVctProfileBaseline } from "../../../lib/api/getVctProfileBaseline";
import { simulatePrediction } from "../../../lib/api/simulatePrediction";
import { toProfileAdjustment, type AttributeControlDefinition, type SimulationPreset } from "../../../lib/whatIfSimulator";

/** Widened so Real Model 2.0 can supply real baseline values keyed by `RealAxisKey` instead of the synthetic `VctProfileBaseline` shape. */
type SimulatorBaselineSide = ControlsTabProps["teamABaseline"];
export interface SimulatorBaseline {
  teamA: SimulatorBaselineSide;
  teamB: SimulatorBaselineSide;
}

export interface WhatIfSimulatorProps {
  result: PredictionResult;
  teamA: Team;
  teamB: Team;
  maps: GameMap[];
  /** Overrides which maps get a per-map strength slider — defaults to `result.scenario.mapIds`. Real Model 2.0 passes `[]`: no real per-map strength baseline exists. */
  simulatorMapIds?: readonly string[];
  /** Defaults to the synthetic `/api/vct-profile-baseline` fetch. Real Model 2.0 passes a function resolving synchronously from already-fetched real team state — never a network call. */
  getBaseline?: (teamAId: string, teamBId: string, mapIds: readonly string[]) => Promise<SimulatorBaseline>;
  /** Defaults to POSTing `/api/simulate-prediction` (the synthetic engine). Real Model 2.0 passes the pure client-side real recompute — never this API route. */
  runSimulation?: (teamAAdjustment: VctProfileAdjustment, teamBAdjustment: VctProfileAdjustment, requestId: string) => Promise<SimulationResult>;
  /** Defaults to the synthetic controls, unchanged from every existing caller. */
  controls?: readonly AttributeControlDefinition[];
  /** Defaults to the synthetic presets, unchanged from every existing caller. */
  presets?: readonly SimulationPreset[];
}

type BaselineFetchStatus = "loading" | "success" | "error";

async function defaultGetBaseline(teamAId: string, teamBId: string, mapIds: readonly string[]): Promise<VctProfileBaselineResponse> {
  return getVctProfileBaseline({ teamAId, teamBId, mapIds: [...mapIds] });
}

async function defaultRunSimulation(
  teamAAdjustment: VctProfileAdjustment,
  teamBAdjustment: VctProfileAdjustment,
  requestId: string,
  scenario: PredictionResult["scenario"],
): Promise<SimulationResult> {
  return simulatePrediction({ requestId, scenario, teamAAdjustment, teamBAdjustment });
}

/**
 * TASK-038 (synthetic), extended by the Prediction Studio mode-correction
 * task to also serve Real Model 2.0. A pure scenario-analysis tool layered
 * over the already-computed baseline `result` — nothing here ever mutates
 * `result` or the source team profiles. The parent (`PredictionResultExperience`)
 * mounts this component with a `key` derived from the scenario's identity,
 * so a genuinely new scenario remounts it (fresh drafts, fresh baseline
 * fetch) while switching the breakdown tabs — which never changes the
 * scenario — leaves it untouched. Because of that remount-on-scenario-change
 * guarantee, `teamA`/`teamB`/`result.scenario.mapIds` are effectively
 * constant for this component's entire mounted lifetime.
 *
 * `getBaseline`/`runSimulation` default to the synthetic engine's HTTP calls
 * (unchanged behavior for every existing caller); Real Model 2.0 injects its
 * own real-data baseline and its own pure client-side recompute instead —
 * this component itself never knows or cares which engine is behind them.
 */
export function WhatIfSimulator({
  result,
  teamA,
  teamB,
  maps,
  simulatorMapIds,
  getBaseline = defaultGetBaseline,
  runSimulation: runSimulationProp,
  controls,
  presets,
}: WhatIfSimulatorProps) {
  const mapIds = simulatorMapIds ?? result.scenario.mapIds;
  const controller = useSimulatorState(mapIds);
  const [baseline, setBaseline] = useState<SimulatorBaseline | null>(null);
  const [baselineStatus, setBaselineStatus] = useState<BaselineFetchStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    getBaseline(teamA.id, teamB.id, mapIds)
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
      const requestId = crypto.randomUUID();
      const teamAAdjustment = toProfileAdjustment(controller.teamADraft, controller.mapADraft);
      const teamBAdjustment = toProfileAdjustment(controller.teamBDraft, controller.mapBDraft);
      const response = runSimulationProp
        ? await runSimulationProp(teamAAdjustment, teamBAdjustment, requestId)
        : await defaultRunSimulation(teamAAdjustment, teamBAdjustment, requestId, result.scenario);
      controller.simulateSuccess(response);
    } catch (err) {
      controller.simulateError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }, [controller, result.scenario, runSimulationProp]);

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
              controls={controls}
              presets={presets}
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
