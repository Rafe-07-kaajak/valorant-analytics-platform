import { requireArg, runCli } from "./cliSupport";
import { loadTeamMappingImportFile, validateTeamMappingImport } from "../mapping/mappingImport";
import { INITIAL_TEAM_MAPPING_REGISTRY } from "../identity/teamMapping";

/**
 * `pnpm ingest:vlr:mapping:import -- <file>` — TASK-043 requirement 21.
 * Validates an externally-supplied team-mapping file against the current
 * in-repo registry and reports what would be added/changed/rejected.
 * Always a dry-run report: this command never writes generated TypeScript
 * source or mutates `identity/teamMapping.ts` — a verified mapping is
 * always added by a human editing that file directly, the same way every
 * existing entry was.
 */
async function main(): Promise<void> {
  const filePath = requireArg(process.argv, 2, "path to a team-mappings.json file");
  const payload = await loadTeamMappingImportFile(filePath);
  const report = validateTeamMappingImport(payload, INITIAL_TEAM_MAPPING_REGISTRY);

  console.log(`Import file: ${filePath}`);
  console.log(`Valid: ${report.valid}`);
  console.log(`Added: ${report.added.length}, Changed: ${report.changed.length}, Unchanged: ${report.unchanged.length}, Rejected: ${report.rejected.length}`);
  console.log("");
  for (const entry of report.added) console.log(`  ADD: ${entry.vlrTeamId} -> ${entry.internalTeamId}`);
  for (const entry of report.changed) console.log(`  CHANGE: ${entry.vlrTeamId} -> ${entry.internalTeamId}`);
  for (const rejection of report.rejected) console.log(`  REJECT: ${JSON.stringify(rejection.entry)} — ${rejection.reasons.join("; ")}`);

  console.log("");
  console.log("This command never writes source files. To apply a verified mapping, add it to identity/teamMapping.ts's INITIAL_TEAM_MAPPING_REGISTRY by hand, following this report.");

  if (!report.valid) process.exitCode = 1;
}

void runCli(main);
