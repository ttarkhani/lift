import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Lets local runs pick up TEST_DATABASE_URL the same way the scripts do.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globalSetup: ["./test/global-setup.ts"],
    // Integration test files share TEST_DATABASE_URL, and some commit data briefly (the
    // accept race needs two real transactions), so files run one at a time.
    fileParallelism: false,
  },
});
