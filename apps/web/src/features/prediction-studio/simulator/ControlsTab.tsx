"use client";

import { Button, Spinner } from "@repo/ui";
import type { VctProfileBaseline } from "@repo/shared";
import { TeamControlsPanel } from "./TeamControlsPanel";
import type { SimulatorController } from "./useSimulatorState";
import { summarizeAdjustments, type AttributeControlDefinition, type SimulationPreset } from "../../../lib/whatIfSimulator";

export interface ControlsTabProps {
  teamAName: string;
  teamBName: string;
  /** Widened from the original single `VctProfileBaseline` shape so a Real Model 2.0 caller can supply real baseline values (`{ values: Record<RealAxisKey, number>, mapStrength: {} }`) instead. */
  teamABaseline: VctProfileBaseline | { values: Record<string, number>; mapStrength: Record<string, number> };
  teamBBaseline: VctProfileBaseline | { values: Record<string, number>; mapStrength: Record<string, number> };
  mapIds: readonly string[];
  mapLabel: (mapId: string) => string;
  controller: SimulatorController;
  onRunSimulation: () => void;
  /** Defaults to the synthetic controls/presets, unchanged from every existing caller. */
  controls?: readonly AttributeControlDefinition[];
  presets?: readonly SimulationPreset[];
}

function baselineValues(baseline: ControlsTabProps["teamABaseline"]): Record<string, number> {
  if ("values" in baseline) return baseline.values;
  const rest: Record<string, number> = {};
  for (const [key, value] of Object.entries(baseline)) {
    if (key !== "mapStrength") rest[key] = value as number;
  }
  return rest;
}

export function ControlsTab({
  teamAName,
  teamBName,
  teamABaseline,
  teamBBaseline,
  mapIds,
  mapLabel,
  controller,
  onRunSimulation,
  controls,
  presets,
}: ControlsTabProps) {
  const isLoading = controller.status === "loading";
  const runDisabled = isLoading || !controller.hasAdjustments;
  const nothingToReset = !controller.hasAdjustments && controller.status === "idle" && !controller.simulationResult;

  const summary = summarizeAdjustments(
    teamAName,
    teamBName,
    controller.teamADraft,
    controller.teamBDraft,
    controller.mapADraft,
    controller.mapBDraft,
    mapLabel,
  );

  return (
    <div className="flex flex-col gap-lg">
      <p className="text-sm text-muted-foreground">
        Adjust any attribute below to build a hypothetical profile, then press Run Simulation to see how it would
        change this matchup&apos;s modeled prediction. Moving a slider only updates your draft here. Nothing is
        sent, and the baseline result above never changes, until you press Run Simulation.
      </p>

      <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
        <TeamControlsPanel
          teamName={teamAName}
          accent="team-a"
          baseline={baselineValues(teamABaseline)}
          mapStrength={teamABaseline.mapStrength}
          draft={controller.teamADraft}
          mapDraft={controller.mapADraft}
          mapIds={mapIds}
          mapLabel={mapLabel}
          onAttributeChange={(key, value) => controller.setAttribute("A", key, value)}
          onAttributeReset={(key) => controller.resetAttribute("A", key)}
          onMapChange={(mapId, value) => controller.setMap("A", mapId, value)}
          onMapReset={(mapId) => controller.resetMap("A", mapId)}
          onApplyPreset={(presetId) => controller.applyPreset("A", presetId)}
          controls={controls}
          presets={presets}
        />
        <TeamControlsPanel
          teamName={teamBName}
          accent="team-b"
          baseline={baselineValues(teamBBaseline)}
          mapStrength={teamBBaseline.mapStrength}
          draft={controller.teamBDraft}
          mapDraft={controller.mapBDraft}
          mapIds={mapIds}
          mapLabel={mapLabel}
          onAttributeChange={(key, value) => controller.setAttribute("B", key, value)}
          onAttributeReset={(key) => controller.resetAttribute("B", key)}
          onMapChange={(mapId, value) => controller.setMap("B", mapId, value)}
          onMapReset={(mapId) => controller.resetMap("B", mapId)}
          onApplyPreset={(presetId) => controller.applyPreset("B", presetId)}
          controls={controls}
          presets={presets}
        />
      </div>

      <div className="flex flex-col gap-2xs rounded-md border border-surface-border bg-surface p-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current draft</span>
        <p className="text-sm text-foreground">{summary}</p>
      </div>

      {controller.error ? (
        <p role="alert" className="text-sm text-danger">
          {controller.error} Your adjustments and any previous simulation are unchanged. You can retry.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-sm">
        <Button type="button" variant="secondary" onClick={controller.resetAll} disabled={nothingToReset}>
          Reset All
        </Button>
        <Button type="button" onClick={onRunSimulation} disabled={runDisabled} aria-busy={isLoading}>
          {isLoading ? (
            <>
              <Spinner size={14} label="Running simulation" />
              Running…
            </>
          ) : (
            "Run Simulation"
          )}
        </Button>
      </div>
    </div>
  );
}
