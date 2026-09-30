import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "cloudflare:workers": fileURLToPath(
        new URL("./test/cloudflareWorkersMock.ts", import.meta.url),
      ),
    },
  },
  test: {
    coverage: { enabled: false },
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
