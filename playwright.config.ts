import { defineConfig, devices } from "@playwright/test";
import os from "node:os";
import path from "node:path";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.e2e\.ts/,
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3200",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], ...(process.env.FZM_E2E_SYSTEM_CHROME === "1" ? { launchOptions: { executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" } } : {}) } }],
  webServer: {
    command: "npm run dev -- --port 3200",
    env: { FZM_V2_DATA_DIR: path.join(os.tmpdir(), "fzm-v2-playwright") },
    url: "http://localhost:3200/v2",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
