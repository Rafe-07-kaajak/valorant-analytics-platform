import type { Team } from "@repo/shared";

export const mockTeams: Team[] = [
  { id: "sen", name: "Sentinels", region: "Americas", logoUrl: "/teams/sen.svg" },
  { id: "loud", name: "LOUD", region: "Americas", logoUrl: "/teams/loud.svg" },
  { id: "fnc", name: "Fnatic", region: "EMEA", logoUrl: "/teams/fnc.svg" },
  { id: "th", name: "Team Heretics", region: "EMEA", logoUrl: "/teams/th.svg" },
  { id: "prx", name: "Paper Rex", region: "Pacific", logoUrl: "/teams/prx.svg" },
  { id: "drx", name: "DRX", region: "Pacific", logoUrl: "/teams/drx.svg" },
  { id: "eg", name: "EDward Gaming", region: "China", logoUrl: "/teams/eg.svg" },
  { id: "trace", name: "Trace Esports", region: "China", logoUrl: "/teams/trace.svg" },
];
