import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(root, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{js,mjs}"],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: [
        "src/lib/api-client.js",
        "src/lib/backup.js",
        "src/lib/ingest.js",
        "src/lib/saved-query-files.js",
        "src/lib/saved-query-import.js",
        "src/lib/schema-export.js",
        "src/lib/zip.js",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 75,
      },
    },
  },
});
