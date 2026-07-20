import { isReleaseError, toSafeReleaseError } from "../releaseErrors";

/** Mirrors `services/model-inference/src/cli/runtimePackageCliSupport.ts` — every `release:*` command shares one error-to-exit-code mapping so failures are reported consistently and never print a raw stack trace. */
export async function runReleaseCli(main: () => Promise<void>): Promise<void> {
  try {
    await main();
  } catch (error) {
    const safe = toSafeReleaseError(error);
    console.error(`Release command failed: [${safe.code}] ${safe.message}`);
    process.exitCode = isReleaseError(error) ? safe.exitCode : 1;
  }
}

/** Minimal `--flag`/`--key value` argv parser, avoiding a new dependency for a handful of CLI flags. */
export function parseCliArgs(argv: readonly string[]): { readonly flags: ReadonlySet<string>; readonly options: ReadonlyMap<string, string> } {
  const flags = new Set<string>();
  const options = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      options.set(key, next);
      i++;
    } else {
      flags.add(key);
    }
  }
  return { flags, options };
}
