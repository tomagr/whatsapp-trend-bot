import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname) } },
  test: { testTimeout: 120_000, hookTimeout: 180_000, fileParallelism: false },
});
