"use client";

import { useMemo, useState } from "react";
import { SERIES_MAP_LIMITS, type GameMap, type Scenario, type SeriesFormat } from "@repo/shared";
import { Button, Card, Label, Select, Spinner, Stack } from "@repo/ui";
import type { VctRegion, VctTeam } from "../../constants/vct";
import { VctTeamSideSelector, EMPTY_SIDE_SELECTION, type SideSelection } from "./VctTeamSideSelector";
import { MapSelector } from "./MapSelector";

export interface ScenarioBuilderProps {
  regions: readonly VctRegion[];
  teams: readonly VctTeam[];
  maps: GameMap[];
  /** Simulated-data disclosure text (TASK-031's `VCT_PROFILE_DISCLOSURE`), passed down from the server component rather than imported here — importing `@repo/prediction-engine` from a client component would pull its Node-only modules (e.g. `node:crypto`) into the browser bundle. */
  disclosure: string;
  isSubmitting: boolean;
  onSubmit: (scenario: Scenario) => void;
}

const EMPTY_SELECTION: SideSelection = EMPTY_SIDE_SELECTION;

export function ScenarioBuilder({ regions, teams, maps, disclosure, isSubmitting, onSubmit }: ScenarioBuilderProps) {
  const [teamASelection, setTeamASelection] = useState<SideSelection>(EMPTY_SELECTION);
  const [teamBSelection, setTeamBSelection] = useState<SideSelection>(EMPTY_SELECTION);
  const [seriesFormat, setSeriesFormat] = useState<SeriesFormat>("BO3");
  const [mapIds, setMapIds] = useState<string[]>([]);

  const maxSelectable = SERIES_MAP_LIMITS[seriesFormat];

  const validationError = useMemo(() => {
    if (!teamASelection.teamId || !teamBSelection.teamId) return "Select both teams to continue.";
    if (teamASelection.teamId === teamBSelection.teamId) return "Team A and Team B must be different.";
    if (mapIds.length === 0) return "Select at least one map.";
    return null;
  }, [teamASelection.teamId, teamBSelection.teamId, mapIds]);

  function handleSeriesFormatChange(next: SeriesFormat) {
    setSeriesFormat(next);
    setMapIds((current) => current.slice(0, SERIES_MAP_LIMITS[next]));
  }

  function toggleMap(mapId: string) {
    setMapIds((current) => {
      if (current.includes(mapId)) {
        return current.filter((id) => id !== mapId);
      }
      if (current.length >= maxSelectable) {
        return current;
      }
      return [...current, mapId];
    });
  }

  function handleSubmit() {
    if (validationError || !teamASelection.teamId || !teamBSelection.teamId) return;
    onSubmit({ teamAId: teamASelection.teamId, teamBId: teamBSelection.teamId, seriesFormat, mapIds });
  }

  return (
    <Card className="flex flex-col gap-lg">
      <div className="flex flex-col gap-lg lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-start lg:gap-md">
        <VctTeamSideSelector
          side="A"
          regions={regions}
          teams={teams}
          regionId={teamASelection.regionId}
          teamId={teamASelection.teamId}
          opposingTeamId={teamBSelection.teamId}
          onRegionChange={(regionId) => setTeamASelection({ regionId, teamId: null })}
          onTeamChange={(teamId) => setTeamASelection((current) => ({ ...current, teamId }))}
        />

        <div
          aria-hidden="true"
          className="flex items-center justify-center text-sm font-semibold uppercase tracking-wide text-muted-foreground lg:h-full"
        >
          VS
        </div>

        <VctTeamSideSelector
          side="B"
          regions={regions}
          teams={teams}
          regionId={teamBSelection.regionId}
          teamId={teamBSelection.teamId}
          opposingTeamId={teamASelection.teamId}
          onRegionChange={(regionId) => setTeamBSelection({ regionId, teamId: null })}
          onTeamChange={(teamId) => setTeamBSelection((current) => ({ ...current, teamId }))}
        />
      </div>

      <Stack gap="2xs">
        <Label htmlFor="series-format">Series Format</Label>
        <Select
          id="series-format"
          value={seriesFormat}
          onChange={(event) => handleSeriesFormatChange(event.target.value as SeriesFormat)}
        >
          <option value="BO3">Best of 3</option>
          <option value="BO5">Best of 5</option>
        </Select>
      </Stack>

      <MapSelector
        maps={maps}
        selectedMapIds={mapIds}
        maxSelectable={maxSelectable}
        onToggle={toggleMap}
      />

      <p className="text-xs text-muted-foreground">{disclosure}</p>

      {validationError ? (
        <p role="alert" className="text-sm text-danger">
          {validationError}
        </p>
      ) : null}

      <Button
        type="button"
        size="lg"
        disabled={Boolean(validationError) || isSubmitting}
        onClick={handleSubmit}
      >
        {isSubmitting ? (
          <>
            <Spinner size={16} className="text-white" />
            Generating Prediction…
          </>
        ) : (
          "Generate Prediction"
        )}
      </Button>
    </Card>
  );
}
