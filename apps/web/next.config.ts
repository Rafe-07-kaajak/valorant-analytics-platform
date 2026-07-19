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
const nextConfig: NextConfig = {};

export default nextConfig;
