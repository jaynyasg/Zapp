import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    permissions: ["camera"],
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
    },
  },
  webServer: {
    command: "node --env-file-if-exists=.env server/index.js",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    env: {
      PORT: "4173",
      DATA_DIR: "data/e2e",
      ANTHROPIC_API_KEY: "",
      OPENAI_API_KEY: "",
      APP_ORIGIN: "http://127.0.0.1:4173",
    },
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
