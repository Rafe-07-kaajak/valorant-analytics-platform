/**
 * Identity bridge for TASK-031's synthetic 32-team profile layer.
 *
 * TASK-030's canonical 4-region / 32-team directory lives in
 * `apps/web/src/constants/vct.ts`. This package cannot import from an app —
 * that would invert the package → app dependency direction — so this file
 * duplicates only the minimum identity needed to generate profiles: each
 * team's stable id and region. These 32 ids are byte-identical to the
 * `VctTeamId` values registered in `apps/web/src/constants/vctLogos.ts`.
 * If TASK-030's roster ever changes, this list must be updated to match.
 *
 * Visual identity (display name, short name, logo path) is intentionally
 * NOT duplicated here — consumers that need it should look up the same id
 * in TASK-030's web directory. This module only ever produces profile IDs
 * for that identity, never a display name.
 */

export type VctRegionId = "americas" | "emea" | "pacific" | "china";

export type VctTeamId =
  | "100-thieves"
  | "furia"
  | "g2-esports"
  | "kru-esports"
  | "leviatan"
  | "loud"
  | "mibr"
  | "nrg"
  | "bbl-esports"
  | "eternal-fire"
  | "fnatic"
  | "fut-esports"
  | "gentle-mates"
  | "team-heretics"
  | "team-liquid"
  | "team-vitality"
  | "detonation-focusme"
  | "full-sense"
  | "global-esports"
  | "kiwoom-drx"
  | "nongshim-redforce"
  | "paper-rex"
  | "rex-regum-qeon"
  | "t1"
  | "all-gamers"
  | "dragon-ranger-gaming"
  | "edward-gaming"
  | "jdg-esports"
  | "titan-esports-club"
  | "trace-esports"
  | "tyloo"
  | "xi-lai-gaming";

export interface VctTeamIdentity {
  id: VctTeamId;
  region: VctRegionId;
}

export const VCT_TEAM_IDENTITIES: readonly VctTeamIdentity[] = [
  // Americas
  { id: "100-thieves", region: "americas" },
  { id: "furia", region: "americas" },
  { id: "g2-esports", region: "americas" },
  { id: "kru-esports", region: "americas" },
  { id: "leviatan", region: "americas" },
  { id: "loud", region: "americas" },
  { id: "mibr", region: "americas" },
  { id: "nrg", region: "americas" },
  // EMEA
  { id: "bbl-esports", region: "emea" },
  { id: "eternal-fire", region: "emea" },
  { id: "fnatic", region: "emea" },
  { id: "fut-esports", region: "emea" },
  { id: "gentle-mates", region: "emea" },
  { id: "team-heretics", region: "emea" },
  { id: "team-liquid", region: "emea" },
  { id: "team-vitality", region: "emea" },
  // Pacific
  { id: "detonation-focusme", region: "pacific" },
  { id: "full-sense", region: "pacific" },
  { id: "global-esports", region: "pacific" },
  { id: "kiwoom-drx", region: "pacific" },
  { id: "nongshim-redforce", region: "pacific" },
  { id: "paper-rex", region: "pacific" },
  { id: "rex-regum-qeon", region: "pacific" },
  { id: "t1", region: "pacific" },
  // China
  { id: "all-gamers", region: "china" },
  { id: "dragon-ranger-gaming", region: "china" },
  { id: "edward-gaming", region: "china" },
  { id: "jdg-esports", region: "china" },
  { id: "titan-esports-club", region: "china" },
  { id: "trace-esports", region: "china" },
  { id: "tyloo", region: "china" },
  { id: "xi-lai-gaming", region: "china" },
];
