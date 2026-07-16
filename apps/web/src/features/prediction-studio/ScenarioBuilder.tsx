"use client";

import { useMemo, useState } from "react";
import { SERIES_MAP_LIMITS, type GameMap, type Scenario, type SeriesFormat, type Team } from "@repo/shared";
import { Button, Card, Label, Select, Spinner, Stack } from "@repo/ui";
import { TeamSelector } from "./TeamSelector";
import { MapSelector } from "./MapSelector";

export interface ScenarioBuilderProps {
  teams: Team[];
  maps: GameMap[];
  isSubmitting: boolean;
  onSubmit: (scenario: Scenario) => void;
}

export function ScenarioBuilder({ teams, maps, isSubmitting, onSubmit }: ScenarioBuilderProps) {
  const [teamAId, setTeamAId] = useState("");
  const [teamBId, setTeamBId] = useState("");
  const [seriesFormat, setSeriesFormat] = useState<SeriesFormat>("BO3");
  const [mapIds, setMapIds] = useState<string[]>([]);

  const maxSelectable = SERIES_MAP_LIMITS[seriesFormat];

  const validationError = useMemo(() => {
    if (!teamAId || !teamBId) return "Select both teams to continue.";
    if (teamAId === teamBId) return "Team A and Team B must be different.";
    if (mapIds.length === 0) return "Select at least one map.";
    return null;
  }, [teamAId, teamBId, mapIds]);

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
    if (validationError) return;
    onSubmit({ teamAId, teamBId, seriesFormat, mapIds });
  }

  return (
    <Card className="flex flex-col gap-lg">
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <TeamSelector
          label="Team A"
          teams={teams}
          value={teamAId}
          excludeTeamId={teamBId}
          onChange={setTeamAId}
        />
        <TeamSelector
          label="Team B"
          teams={teams}
          value={teamBId}
          excludeTeamId={teamAId}
          onChange={setTeamBId}
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
