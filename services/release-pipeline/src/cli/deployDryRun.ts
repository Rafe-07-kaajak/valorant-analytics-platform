import { loadReleasePipelineConfig } from "../releaseConfig";
import { buildDeploymentPlan, type DeploymentTarget } from "../deployDryRun";
import { buildFixtureReleaseInputs } from "../testFixtures/buildFixtureReleaseInputs";
import { buildReleaseBundle } from "../bundleBuilder";
import { parseCliArgs, runReleaseCli } from "./cliSupport";

const VALID_TARGETS: readonly DeploymentTarget[] = ["local-node-server", "generic-linux-vm", "container-docker", "ci-artifact-handoff", "manual-operator-deployment"];

/** `pnpm release:deploy:dry-run` — TASK-049 section 13. Reads an already-built bundle and produces a deployment plan. Performs no deployment, no network request, uses no credential, and changes nothing outside its own return value. */
async function main(): Promise<void> {
  const { flags, options } = parseCliArgs(process.argv.slice(2));
  const targetOption = options.get("target");
  const target: DeploymentTarget = targetOption && (VALID_TARGETS as readonly string[]).includes(targetOption) ? (targetOption as DeploymentTarget) : "local-node-server";

  let bundleDir: string;
  if (flags.has("fixture")) {
    const fixture = await buildFixtureReleaseInputs();
    const built = await buildReleaseBundle({ config: fixture.config });
    bundleDir = built.outputDir;
  } else {
    bundleDir = loadReleasePipelineConfig().bundleOutputDir;
  }

  const plan = await buildDeploymentPlan(bundleDir, target);
  console.log(JSON.stringify(plan, null, 2));
  for (const disclaimer of plan.disclaimers) console.log(disclaimer);
}

void runReleaseCli(main);
