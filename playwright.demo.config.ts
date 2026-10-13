import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser-v2",
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://localhost:3001",
    channel: "msedge",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev:demo -- --port 3001",
    env: { GAMBLING_TEST_SERVER: "demo" },
    url: "http://localhost:3001",
    reuseExistingServer: false,
    timeout: 90000,
  },
});
