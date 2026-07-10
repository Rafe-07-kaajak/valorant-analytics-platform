import type { Team } from "@repo/shared";
import { Select } from "@repo/ui";

export interface TeamSelectorProps {
  label: string;
  teams: Team[];
  value: string;
  excludeTeamId?: string;
  onChange: (teamId: string) => void;
}

export function TeamSelector({ label, teams, value, excludeTeamId, onChange }: TeamSelectorProps) {
  const options = teams.filter((team) => team.id !== excludeTeamId);

  return (
    <label className="flex flex-col gap-2xs">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select a team</option>
        {options.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name} — {team.region}
          </option>
        ))}
      </Select>
    </label>
  );
}
