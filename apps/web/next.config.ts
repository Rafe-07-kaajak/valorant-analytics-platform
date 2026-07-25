import type { NextConfig } from "next";
import { resolve } from "node:path";

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
  // Vercel deployment fix (round 2) — pinned explicitly rather than left to
  // Next's own monorepo-lockfile inference, so `outputFileTracingIncludes`
  // below resolves identically between a local build and Vercel's build
  // (both treat `apps/web` — this repo's Vercel Root Directory — as the
  // trace root).
  outputFileTracingRoot: resolve(process.cwd(), "..", ".."),
  // The four real-prediction API routes read the committed data snapshot at
  // `apps/web/server-data/vlr-data/**` (see
  // `apps/web/src/server/prediction/config.ts`'s `defaultFeatureDataDir()`
  // and `services/model-inference/src/config.ts`'s `defaultArtifactDir()`)
  // via a fully dynamic `fs.readFile(resolveSafePath(configuredDir, ...))`
  // call. Next's build-time file tracer (`@vercel/nft`) only follows static
  // `import`/`require` graphs, so it cannot discover these files on its own
  // — without this, Vercel's deployed function bundle silently omits them
  // even though they're committed to git, and every real-prediction route
  // fails at runtime with "not available locally" in production only.
  //
  // The snapshot lives inside `apps/web` itself (not across a monorepo
  // package boundary at `services/vlr-ingestion/...`) so this include path
  // never depends on how many directories separate two independently
  // versioned packages — see docs/36, "Vercel deployment" for the full
  // history of why this moved here.
  outputFileTracingIncludes: {
    "/api/internal/prediction/**": ["./server-data/vlr-data/**"],
  },
};

export default nextConfig;
