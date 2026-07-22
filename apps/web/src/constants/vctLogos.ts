/**
 * Central registry for VCT 2026 Stage 1 region and team logos at
 * `public/assets/vct/`. Every logo used anywhere in the app resolves
 * through this manifest instead of a hardcoded path, so a component always
 * knows a logo's stable URL and which region it belongs to.
 *
 * Source: TASK-029 region and team logo asset audit. Only teams whose
 * identity could be confidently read from the source filenames are
 * registered here — see the task report for the full audit.
 */

export type VctRegionId = "americas" | "emea" | "pacific" | "china";

export interface RegionLogoAsset {
  id: VctRegionId;
  name: string;
  logoPath: string;
}

export interface TeamLogoAsset {
  id: string;
  name: string;
  shortName: string;
  region: VctRegionId;
  logoPath: string;
}

export const VCT_REGION_LOGOS = {
  americas: {
    id: "americas",
    name: "VCT Americas",
    logoPath: "/assets/vct/regions/americas/vct-americas.png",
  },
  emea: {
    id: "emea",
    name: "VCT EMEA",
    logoPath: "/assets/vct/regions/emea/vct-emea-light.png",
  },
  pacific: {
    id: "pacific",
    name: "VCT Pacific",
    logoPath: "/assets/vct/regions/pacific/vct-pacific.png",
  },
  china: {
    id: "china",
    name: "VCT China",
    logoPath: "/assets/vct/regions/china/vct-china.png",
  },
} as const satisfies Record<VctRegionId, RegionLogoAsset>;

export const VCT_TEAM_LOGOS = [
  // Americas
  {
    id: "100-thieves",
    name: "100 Thieves",
    shortName: "100T",
    region: "americas",
    logoPath: "/assets/vct/teams/americas/100-thieves.png",
  },
  {
    id: "furia",
    name: "FURIA",
    shortName: "FUR",
    region: "americas",
    logoPath: "/assets/vct/teams/americas/furia.png",
  },
  {
    id: "g2-esports",
    name: "G2 Esports",
    shortName: "G2",
    region: "americas",
    logoPath: "/assets/vct/teams/americas/g2-esports.png",
  },
  {
    id: "kru-esports",
    name: "KRÜ Esports",
    shortName: "KRÜ",
    region: "americas",
    logoPath: "/assets/vct/teams/americas/kru-esports.png",
  },
  {
    id: "leviatan",
    name: "LEVIATÁN",
    shortName: "LEV",
    region: "americas",
    logoPath: "/assets/vct/teams/americas/leviatan.png",
  },
  {
    id: "loud",
    name: "LOUD",
    shortName: "LOUD",
    region: "americas",
    logoPath: "/assets/vct/teams/americas/loud.png",
  },
  {
    id: "mibr",
    name: "MIBR",
    shortName: "MIBR",
    region: "americas",
    logoPath: "/assets/vct/teams/americas/mibr.png",
  },
  {
    id: "nrg",
    name: "NRG",
    shortName: "NRG",
    region: "americas",
    logoPath: "/assets/vct/teams/americas/nrg.png",
  },
  // EMEA
  {
    id: "bbl-esports",
    name: "BBL Esports",
    shortName: "BBL",
    region: "emea",
    logoPath: "/assets/vct/teams/emea/bbl-esports.png",
  },
  {
    id: "eternal-fire",
    name: "Eternal Fire",
    shortName: "EF",
    region: "emea",
    logoPath: "/assets/vct/teams/emea/eternal-fire.png",
  },
  {
    id: "fnatic",
    name: "FNATIC",
    shortName: "FNC",
    region: "emea",
    logoPath: "/assets/vct/teams/emea/fnatic.png",
  },
  {
    id: "fut-esports",
    name: "FUT Esports",
    shortName: "FUT",
    region: "emea",
    logoPath: "/assets/vct/teams/emea/fut-esports.png",
  },
  {
    id: "gentle-mates",
    name: "Gentle Mates",
    shortName: "M8",
    region: "emea",
    logoPath: "/assets/vct/teams/emea/gentle-mates.png",
  },
  {
    id: "team-heretics",
    name: "Team Heretics",
    shortName: "TH",
    region: "emea",
    logoPath: "/assets/vct/teams/emea/team-heretics.png",
  },
  {
    id: "team-liquid",
    name: "Team Liquid",
    shortName: "TL",
    region: "emea",
    logoPath: "/assets/vct/teams/emea/team-liquid.png",
  },
  {
    id: "team-vitality",
    name: "Team Vitality",
    shortName: "VIT",
    region: "emea",
    logoPath: "/assets/vct/teams/emea/team-vitality.png",
  },
  // Pacific
  {
    id: "detonation-focusme",
    name: "DetonatioN FocusMe",
    shortName: "DFM",
    region: "pacific",
    logoPath: "/assets/vct/teams/pacific/detonation-focusme.png",
  },
  {
    id: "full-sense",
    name: "Full Sense",
    shortName: "FS",
    region: "pacific",
    logoPath: "/assets/vct/teams/pacific/full-sense.png",
  },
  {
    id: "global-esports",
    name: "Global Esports",
    shortName: "GE",
    region: "pacific",
    logoPath: "/assets/vct/teams/pacific/global-esports.png",
  },
  {
    id: "kiwoom-drx",
    name: "Kiwoom DRX",
    shortName: "DRX",
    region: "pacific",
    logoPath: "/assets/vct/teams/pacific/kiwoom-drx.png",
  },
  {
    id: "nongshim-redforce",
    name: "Nongshim RedForce",
    shortName: "NS",
    region: "pacific",
    logoPath: "/assets/vct/teams/pacific/nongshim-redforce.png",
  },
  {
    id: "paper-rex",
    name: "Paper Rex",
    shortName: "PRX",
    region: "pacific",
    logoPath: "/assets/vct/teams/pacific/paper-rex.png",
  },
  {
    id: "rex-regum-qeon",
    name: "Rex Regum Qeon",
    shortName: "RRQ",
    region: "pacific",
    logoPath: "/assets/vct/teams/pacific/rex-regum-qeon.png",
  },
  {
    id: "t1",
    name: "T1",
    shortName: "T1",
    region: "pacific",
    logoPath: "/assets/vct/teams/pacific/t1.png",
  },
  // China
  {
    id: "all-gamers",
    name: "All Gamers",
    shortName: "AG",
    region: "china",
    logoPath: "/assets/vct/teams/china/all-gamers.png",
  },
  {
    id: "dragon-ranger-gaming",
    name: "Dragon Ranger Gaming",
    shortName: "DRG",
    region: "china",
    logoPath: "/assets/vct/teams/china/dragon-ranger-gaming.png",
  },
  {
    id: "edward-gaming",
    name: "EDward Gaming",
    shortName: "EDG",
    region: "china",
    logoPath: "/assets/vct/teams/china/edward-gaming.png",
  },
  {
    id: "jdg-esports",
    name: "JDG Esports",
    shortName: "JDG",
    region: "china",
    logoPath: "/assets/vct/teams/china/jdg-esports.png",
  },
  {
    id: "titan-esports-club",
    name: "Titan Esports Club",
    shortName: "TEC",
    region: "china",
    logoPath: "/assets/vct/teams/china/titan-esports-club.png",
  },
  {
    id: "trace-esports",
    name: "Trace Esports",
    shortName: "TE",
    region: "china",
    logoPath: "/assets/vct/teams/china/trace-esports.png",
  },
  {
    id: "tyloo",
    name: "TYLOO",
    shortName: "TYL",
    region: "china",
    logoPath: "/assets/vct/teams/china/tyloo.png",
  },
  {
    id: "xi-lai-gaming",
    name: "Xi Lai Gaming",
    shortName: "XLG",
    region: "china",
    logoPath: "/assets/vct/teams/china/xi-lai-gaming.png",
  },
] as const satisfies readonly TeamLogoAsset[];
