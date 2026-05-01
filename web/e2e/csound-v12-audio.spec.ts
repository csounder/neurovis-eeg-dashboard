import { expect, test, type Page } from "@playwright/test";

/** Headless Chromium often leaves this at 0 for Csound WASM; use smoke test in CI. */
const RMS_THRESHOLD = 0.0002;

/** Prefer testids; allow panel + `pre` for older bundles; last resort: heading-scoped `pre` (e.g. stale dev server without testids on `pre`). */
function csoundConsoleLog(page: Page) {
  return page
    .locator(
      '[data-testid="v12-csound-console"], [data-testid="v12-csound-console-panel"] pre',
    )
    .or(
      page
        .locator("div")
        .filter({ has: page.getByText("Csound Console", { exact: true }) })
        .locator("pre")
        .first(),
    );
}

async function startV12Audio(page: Page) {
  await page.goto("/v12", { waitUntil: "load" });

  const startBtn = page.getByTestId("v12-start-audio");
  await startBtn.waitFor({ state: "visible", timeout: 30_000 });
  await startBtn.scrollIntoViewIfNeeded();
  await expect(startBtn).toBeEnabled();
  await startBtn.click({ force: true });

  await expect(page.getByTestId("v12-csound-status")).toContainText("running", {
    timeout: 150_000,
  });
}

test.describe("V12 browser Csound", () => {
  test("smoke: engine reaches running, wiring logged, audition reaches console", async ({ page }) => {
    await startV12Audio(page);

    const consoleEl = csoundConsoleLog(page);
    await consoleEl.scrollIntoViewIfNeeded();
    await expect(consoleEl).toContainText("Compiled lightweight NeuroVis browser Csound orchestra", {
      timeout: 120_000,
    });
    await expect(consoleEl).toContainText("before start()", { timeout: 60_000 });

    await page.getByTestId("v12-audition-csound-engine").click();
    await expect(consoleEl).toContainText("Auditioning browser Csound engine test tone.", {
      timeout: 45_000,
    });
  });

  test("audio: concert meter RMS after audition (local / headed)", async ({ page }) => {
    test.skip(
      !!process.env.CI,
      "Headless CI: analyser RMS stays ~0 with Csound WASM; smoke test validates compile/start/audition path.",
    );

    await startV12Audio(page);

    await expect
      .poll(
        async () => page.evaluate(() => typeof (window as unknown as { __nvConcertLevel?: unknown }).__nvConcertLevel),
        { timeout: 15_000, intervals: [50, 100, 200] },
      )
      .toBe("function");

    const audition = page.getByTestId("v12-audition-csound-engine");
    for (let i = 0; i < 6; i += 1) {
      await audition.click();
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(2500);

    await expect
      .poll(
        async () => {
          return await page.evaluate(() => {
            const probe = (window as unknown as { __nvConcertLevel?: () => number }).__nvConcertLevel;
            return probe ? probe() : -1;
          });
        },
        { timeout: 120_000, intervals: [150, 300, 500, 1000] },
      )
      .toBeGreaterThan(RMS_THRESHOLD);
  });
});
