import { execFileSync } from "node:child_process";

/**
 * Read-only Git state inspection — every call uses `execFileSync` with an
 * argv array (never a shell string), so there is no command-injection
 * surface even though this only ever runs against a fixed, hardcoded
 * argument list. Every function is best-effort: a missing `git` binary, a
 * non-repository working directory, or any other failure resolves to a
 * safe "unavailable" result rather than throwing — release identity and
 * preflight both need to keep working (informationally degraded) when Git
 * state cannot be read, per `sourceCommitSha`'s "when available" contract.
 */

export interface GitState {
  readonly commitSha: string | undefined;
  readonly branch: string | undefined;
  readonly isDirty: boolean;
  readonly dirtyFiles: readonly string[];
}

function runGit(cwd: string, args: readonly string[]): string | undefined {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return undefined;
  }
}

export function inspectGitState(cwd: string): GitState {
  const commitSha = runGit(cwd, ["rev-parse", "HEAD"]);
  const branch = runGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const statusOutput = runGit(cwd, ["status", "--porcelain"]);
  const dirtyFiles = statusOutput ? statusOutput.split("\n").filter((line) => line.trim().length > 0) : [];

  return {
    commitSha: commitSha && commitSha.length > 0 ? commitSha : undefined,
    branch: branch && branch.length > 0 && branch !== "HEAD" ? branch : undefined,
    isDirty: dirtyFiles.length > 0,
    dirtyFiles,
  };
}
