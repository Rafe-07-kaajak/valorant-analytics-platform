import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Fixture and unit tests never touch the network — see
    // docs/29-vlr-data-ingestion-foundation.md ("Network Kill Switch").
    env: {
      VLR_NETWORK_ENABLED: "false",
    },
  },
});
