import { defineConfig, devices } from "@playwright/test";

/** Default dev port for E2E only; override with PLAYWRIGHT_WEB_PORT if busy. */
const WEB_PORT = process.env.PLAYWRIGHT_WEB_PORT || "3110";
const BASE_URL = `http://localhost:${WEB_PORT}`;
const isCi = !!process.env.CI;
/** Stale `next dev` on this port (without current testids) makes smoke fail while the UI still shows logs; opt in to reuse with PLAYWRIGHT_REUSE_SERVER=1. */
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_SERVER === "1";

/**
 * E2E runs with NEXT_PUBLIC_PLAYWRIGHT=1 so the V12 page exposes
 * window.__nvConcertLevel + __nvMeterProbe (Playwright builds).
 *
 * In CI, the webServer runs **only** `next start` (no inline `next build`). Running the
 * full production build inside Playwright’s webServer process, then keeping that shell
 * alive while launching Chromium, can spike memory and get the server **SIGKILL’d** (Killed: 9).
 * Use `npm run test:e2e:ci` so `next build` finishes **before** Playwright starts.
 *
 * Local `npm run test:e2e` starts its own server on `PLAYWRIGHT_WEB_PORT` (default 3110). To attach
 * to an already-running dev server instead, set `PLAYWRIGHT_REUSE_SERVER=1` (ensure that process
 * matches the current branch or assertions can fail on missing `data-testid`s).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 300_000,
  expect: { timeout: 90_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    navigationTimeout: 90_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: ["--autoplay-policy=no-user-gesture-required", "--disable-dev-shm-usage"],
        },
      },
    },
  ],
  webServer: {
    command: isCi ? `npx next start -p ${WEB_PORT}` : `npx next dev -p ${WEB_PORT}`,
    url: `${BASE_URL}/v12`,
    reuseExistingServer,
    timeout: isCi ? 120_000 : 180_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      NEXT_PUBLIC_PLAYWRIGHT: "1",
    },
  },
});
