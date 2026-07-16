import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { VCT_REGION_LOGOS, VCT_TEAM_LOGOS, type RegionLogoAsset, type TeamLogoAsset } from "./vctLogos";
import { validateVctLogoManifest } from "./vctLogos.validate";

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "public");

function assetExistsOnDisk(logoPath: string): boolean {
  return existsSync(join(PUBLIC_DIR, logoPath));
}

describe("VCT logo manifest", () => {
  it("has exactly four regions, each with a registered logo", () => {
    expect(Object.keys(VCT_REGION_LOGOS).sort()).toEqual(["americas", "china", "emea", "pacific"]);
  });

  it("has eight teams per region", () => {
    const counts = { americas: 0, emea: 0, pacific: 0, china: 0 };
    for (const team of VCT_TEAM_LOGOS) {
      counts[team.region] += 1;
    }
    expect(counts).toEqual({ americas: 8, emea: 8, pacific: 8, china: 8 });
  });

  it("passes validation against the real asset files on disk", () => {
    const issues = validateVctLogoManifest(VCT_REGION_LOGOS, VCT_TEAM_LOGOS, assetExistsOnDisk);
    expect(issues).toEqual([]);
  });
});

describe("validateVctLogoManifest", () => {
  const okAssetExists = () => true;

  function regionLogos(overrides: Partial<Record<string, RegionLogoAsset>> = {}) {
    return {
      americas: { id: "americas", name: "VCT Americas", logoPath: "/assets/vct/regions/americas/vct-americas.png" },
      emea: { id: "emea", name: "VCT EMEA", logoPath: "/assets/vct/regions/emea/vct-emea.png" },
      pacific: { id: "pacific", name: "VCT Pacific", logoPath: "/assets/vct/regions/pacific/vct-pacific.png" },
      china: { id: "china", name: "VCT China", logoPath: "/assets/vct/regions/china/vct-china.png" },
      ...overrides,
    } as Record<"americas" | "emea" | "pacific" | "china", RegionLogoAsset>;
  }

  function team(overrides: Partial<TeamLogoAsset> = {}): TeamLogoAsset {
    return {
      id: "paper-rex",
      name: "Paper Rex",
      shortName: "PRX",
      region: "pacific",
      logoPath: "/assets/vct/teams/pacific/paper-rex.png",
      ...overrides,
    };
  }

  it("accepts a well-formed manifest", () => {
    expect(validateVctLogoManifest(regionLogos(), [team()], okAssetExists)).toEqual([]);
  });

  it("flags a missing region logo", () => {
    const incomplete = regionLogos();
    delete (incomplete as Partial<typeof incomplete>).pacific;
    const issues = validateVctLogoManifest(incomplete, [team()], okAssetExists);
    expect(issues.some((issue) => issue.code === "missing-region-logo")).toBe(true);
  });

  it("flags duplicate team ids", () => {
    const issues = validateVctLogoManifest(
      regionLogos(),
      [team(), team({ logoPath: "/assets/vct/teams/pacific/paper-rex-2.png" })],
      okAssetExists,
    );
    expect(issues.some((issue) => issue.code === "duplicate-id")).toBe(true);
  });

  it("flags duplicate team logo paths", () => {
    const issues = validateVctLogoManifest(
      regionLogos(),
      [team(), team({ id: "paper-rex-2" })],
      okAssetExists,
    );
    expect(issues.some((issue) => issue.code === "duplicate-path")).toBe(true);
  });

  it("flags a team referencing an unknown region", () => {
    const issues = validateVctLogoManifest(
      regionLogos(),
      [team({ region: "unknown" as TeamLogoAsset["region"] })],
      okAssetExists,
    );
    expect(issues.some((issue) => issue.code === "invalid-region")).toBe(true);
  });

  it("flags an absolute Windows path", () => {
    const issues = validateVctLogoManifest(
      regionLogos(),
      [team({ logoPath: "C:\\Users\\PC\\Downloads\\paper-rex.png" })],
      okAssetExists,
    );
    expect(issues.some((issue) => issue.code === "absolute-path")).toBe(true);
  });

  it("flags a path with no matching asset on disk", () => {
    const issues = validateVctLogoManifest(regionLogos(), [team()], () => false);
    expect(issues.some((issue) => issue.code === "missing-asset-file")).toBe(true);
  });
});
