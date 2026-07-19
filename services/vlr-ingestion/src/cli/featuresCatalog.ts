import { loadVlrIngestionConfig } from "../env";
import { formatFeatureCatalogReport } from "../feature/featureCatalog";
import { runCli } from "./cliSupport";

/**
 * `pnpm ingest:vlr:features:catalog` — TASK-044 requirement 18. Prints the
 * human-readable feature lineage report; the machine-readable version is
 * written to `<dataDir>/features/feature-catalog.json` by
 * `pnpm ingest:vlr:features:build`. Network-free; reads no curated data at
 * all (the catalog is a static description of the schema itself).
 */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();
  console.log(`Data directory: ${config.dataDir} (catalog is schema-only — no dataset read required)`);
  console.log("");
  console.log(formatFeatureCatalogReport());
}

void runCli(main);
