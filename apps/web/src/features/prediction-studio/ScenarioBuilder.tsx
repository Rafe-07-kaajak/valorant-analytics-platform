"use client";

import { useMemo, useState } from "react";
import type { GameMap, Scenario, SeriesFormat, Team } from "@repo/shared";
import { Button, Card, Select } from "@repo/ui";
import { TeamSelector } from "./TeamSelector";
import { MapSelector } from "./MapSelector";

const SERIES_MAP_LIMITS: Record<SeriesFormat, number> = { BO3: 3, BO5: 5 };

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

      <label className="flex flex-col gap-2xs">
        <span className="text-sm font-medium text-foreground">Series Format</span>
        <Select
          value={seriesFormat}
          onChange={(event) => handleSeriesFormatChange(event.target.value as SeriesFormat)}
        >
          <option value="BO3">Best of 3</option>
          <option value="BO5">Best of 5</option>
        </Select>
      </label>

      <MapSelector
        maps={maps}
        selectedMapIds={mapIds}
        maxSelectable={maxSelectable}
        onToggle={toggleMap}
      />

      {validationError ? <p className="text-sm text-danger">{validationError}</p> : null}

      <Button
        type="button"
        size="lg"
        disabled={Boolean(validationError) || isSubmitting}
        onClick={handleSubmit}
      >
        {isSubmitting ? "Generating Prediction…" : "Generate Prediction"}
      </Button>
    </Card>
  );
}
