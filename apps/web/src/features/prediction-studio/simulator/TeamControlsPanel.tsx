"use client";

import { cn } from "@repo/ui";
import type { VctProfileBaseline } from "@repo/shared";
import { AttributeSlider } from "./AttributeSlider";
import { usePointerGlow } from "../../../hooks/usePointerGlow";
import { ATTRIBUTE_CONTROLS, SIMULATION_PRESETS, type AttributeControlKey, type MapDraftAdjustment, type TeamDraftAdjustment } from "../../../lib/whatIfSimulator";

export interface TeamControlsPanelProps {
  teamName: string;
  accent: "team-a" | "team-b";
  baseline: VctProfileBaseline;
  draft: TeamDraftAdjustment;
  mapDraft: MapDraftAdjustment;
  mapIds: readonly string[];
  mapLabel: (mapId: string) => string;
  onAttributeChange: (key: AttributeControlKey, value: number) => void;
  onAttributeReset: (key: AttributeControlKey) => void;
  onMapChange: (mapId: string, value: number) => void;
  onMapReset: (mapId: string) => void;
  onApplyPreset: (presetId: string) => void;
}

const CORE_CONTROLS = ATTRIBUTE_CONTROLS.filter((control) => control.affectsPrediction);
const ADDITIONAL_CONTROLS = ATTRIBUTE_CONTROLS.filter((control) => !control.affectsPrediction);

export function TeamControlsPanel({
  teamName,
  accent,
  baseline,
  draft,
  mapDraft,
  mapIds,
  mapLabel,
  onAttributeChange,
  onAttributeReset,
  onMapChange,
  onMapReset,
  onApplyPreset,
}: TeamControlsPanelProps) {
  const glow = usePointerGlow<HTMLButtonElement>();

  return (
    <div className="flex flex-col gap-md">
      <h4 className="flex items-center gap-2xs text-base font-semibold text-foreground">
        {/* A colored dot rather than colored text — text-team-a/text-team-b fails WCAG AA
            contrast against the surface background at this size/weight; same precedent as
            SelectedTeamSummary/TeamDnaCard. */}
        <span
          className={cn("inline-block size-2.5 rounded-full", accent === "team-a" ? "bg-team-a" : "bg-team-b")}
          aria-hidden="true"
        />
        {teamName}
      </h4>

      <div className="flex flex-col gap-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Core modeled attributes
        </span>
        {CORE_CONTROLS.map((control) => (
          <AttributeSlider
            key={control.key}
            id={`sim-${accent}-${control.key}`}
            accent={accent}
            teamName={teamName}
            label={control.label}
            baseline={baseline[control.key]}
            delta={draft[control.key]}
            ariaLabel={`${teamName} ${control.label}: baseline ${baseline[control.key]}, adjustment ${draft[control.key] > 0 ? "+" : ""}${draft[control.key]} relative to baseline`}
            onChange={(value) => onAttributeChange(control.key, value)}
            onReset={() => onAttributeReset(control.key)}
          />
        ))}
      </div>

      <div className="flex flex-col gap-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Additional profile attributes
        </span>
        <p className="text-xs text-muted-foreground">
          Tracked on the simulated profile and visible in the Change Breakdown, but the current model doesn&apos;t
          weigh these five directly. Adjusting them won&apos;t move the headline probability below.
        </p>
        {ADDITIONAL_CONTROLS.map((control) => (
          <AttributeSlider
            key={control.key}
            id={`sim-${accent}-${control.key}`}
            accent={accent}
            teamName={teamName}
            label={control.label}
            baseline={baseline[control.key]}
            delta={draft[control.key]}
            ariaLabel={`${teamName} ${control.label}: baseline ${baseline[control.key]}, adjustment ${draft[control.key] > 0 ? "+" : ""}${draft[control.key]} relative to baseline, tracked only, no effect on the modeled probability`}
            onChange={(value) => onAttributeChange(control.key, value)}
            onReset={() => onAttributeReset(control.key)}
          />
        ))}
      </div>

      {mapIds.length > 0 ? (
        <div className="flex flex-col gap-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Map-specific strength (selected maps only)
          </span>
          {mapIds.map((mapId) => (
            <AttributeSlider
              key={mapId}
              id={`sim-${accent}-map-${mapId}`}
              accent={accent}
              teamName={teamName}
              label={mapLabel(mapId)}
              baseline={baseline.mapStrength[mapId] ?? 50}
              delta={mapDraft[mapId] ?? 0}
              ariaLabel={`${teamName} modeled strength on ${mapLabel(mapId)}: baseline ${baseline.mapStrength[mapId] ?? 50}, adjustment ${(mapDraft[mapId] ?? 0) > 0 ? "+" : ""}${mapDraft[mapId] ?? 0} relative to baseline`}
              onChange={(value) => onMapChange(mapId, value)}
              onReset={() => onMapReset(mapId)}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No maps are selected in this scenario yet.</p>
      )}

      <div className="flex flex-col gap-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Presets</span>
        <div className="flex flex-wrap gap-2xs">
          {SIMULATION_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApplyPreset(preset.id)}
              onPointerEnter={glow.onPointerEnter}
              onPointerMove={glow.onPointerMove}
              onPointerLeave={glow.onPointerLeave}
              title={preset.description}
              aria-label={`Apply ${preset.label} preset to ${teamName}: ${preset.description}`}
              className={cn(
                "pointer-glow min-h-11 rounded-sm border border-surface-border bg-surface px-xs py-2xs text-left text-xs font-medium text-foreground",
                "transition-colors duration-(--duration-fast) ease-(--ease-standard) hover:border-foreground/25",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
