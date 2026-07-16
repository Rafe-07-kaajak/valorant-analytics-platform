import type { VctRegion, VctRegionId, VctTeam, VctTeamId } from "../../constants/vct";
import { RegionCard } from "./RegionCard";
import { TeamCard } from "./TeamCard";
import { SelectedTeamSummary } from "./SelectedTeamSummary";

export interface VctTeamSideSelectorProps {
  side: "A" | "B";
  regions: readonly VctRegion[];
  teams: readonly VctTeam[];
  regionId: VctRegionId | null;
  teamId: VctTeamId | null;
  /** The other side's currently selected team, if any — disables that card here. */
  opposingTeamId: VctTeamId | null;
  onRegionChange: (regionId: VctRegionId) => void;
  onTeamChange: (teamId: VctTeamId) => void;
}

const CARD_GRID_CLASSES = "grid grid-cols-2 gap-2xs sm:grid-cols-4";

export function VctTeamSideSelector({
  side,
  regions,
  teams,
  regionId,
  teamId,
  opposingTeamId,
  onRegionChange,
  onTeamChange,
}: VctTeamSideSelectorProps) {
  const headingId = `team-${side.toLowerCase()}-heading`;
  const selectedTeam = teamId ? (teams.find((candidate) => candidate.id === teamId) ?? null) : null;
  const teamsInRegion = regionId ? teams.filter((candidate) => candidate.region === regionId) : [];
  const opposingSide = side === "A" ? "B" : "A";

  return (
    <div className="flex flex-col gap-sm">
      <h2 id={headingId} className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Team {side}
      </h2>

      <div role="group" aria-label={`Team ${side} region`} className={CARD_GRID_CLASSES}>
        {regions.map((region) => (
          <RegionCard
            key={region.id}
            region={region}
            selected={region.id === regionId}
            onSelect={() => onRegionChange(region.id)}
          />
        ))}
      </div>

      {regionId ? (
        <div role="group" aria-label={`Team ${side} team`} className={CARD_GRID_CLASSES}>
          {teamsInRegion.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              side={side}
              selected={team.id === teamId}
              disabledReason={team.id === opposingTeamId ? `Already selected by Team ${opposingSide}.` : undefined}
              onSelect={() => onTeamChange(team.id)}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Select a region to see its teams.</p>
      )}

      {selectedTeam ? (
        <SelectedTeamSummary team={selectedTeam} side={side} />
      ) : regionId ? (
        <p className="text-sm text-muted-foreground">Select a team to continue.</p>
      ) : null}
    </div>
  );
}
