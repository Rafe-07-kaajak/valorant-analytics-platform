import type { NextConfig } from "next";

// TASK-048: `output: "standalone"` is the recommended setting for a
// container deployment target (see docs/36, "Next.js integration") but is
// deliberately NOT enabled here: Next's standalone trace-copy step recreates
// pnpm's symlinked node_modules layout, which requires OS-level symlink
// privileges (`SeCreateSymbolicLinkPrivilege`) — verified unavailable on a
// non-admin/non-Developer-Mode Windows checkout (`pnpm build` fails with
// `EPERM: operation not permitted, symlink`). Enabling it here would break
// local development builds on Windows. A container build pipeline can set
// this in its own build-time config (or run on Linux/WSL, where this
// restriction does not apply) without needing to change this shared file —
// see docs/36 for the exact opt-in guidance.
const nextConfig: NextConfig = {
  // Vercel deployment fix — the four real-prediction API routes read the
  // committed data snapshot at `services/vlr-ingestion/data/vlr-data/**`
  // (see `apps/web/src/server/prediction/config.ts`'s `defaultFeatureDataDir()`
  // and `services/model-inference/src/config.ts`'s `defaultArtifactDir()`)
  // via a fully dynamic `fs.readFile(resolveSafePath(configuredDir, ...))`
  // call. Next's build-time file tracer (`@vercel/nft`) only follows static
  // `import`/`require` graphs, so it cannot discover these files on its own
  // — without this, Vercel's deployed function bundle silently omits them
  // even though they're committed to git, and every real-prediction route
  // fails at runtime with "not available locally" in production only. See
  // docs/36, "Vercel deployment."
  outputFileTracingIncludes: {
    "/api/internal/prediction/**": ["../../services/vlr-ingestion/data/vlr-data/**"],
  },
};

export default nextConfig;
