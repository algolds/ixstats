#!/usr/bin/env node
// scripts/verify-world-editor-properties-panel.mjs
// Plan 025 — drives a real browser against `bun run dev` and asserts
// the right panel of the world editor populates with "Country Profile"
// or "Unclaimed Territory" after a canvas click.
//
// Usage:
//   1. Start the dev server in another shell:
//        bun run dev
//   2. Wait for http://localhost:3000/admin/maps/editor to respond.
//   3. Run:
//        node scripts/verify-world-editor-properties-panel.mjs
//
// Exit codes (used by the plan's STOP conditions):
//   0 — PROPERTIES_PANEL_OK printed; right panel shows a profile.
//   1 — unexpected exception (Playwright not installed, etc).
//   2 — dev server unreachable on http://localhost:3000.
//   3 — MapLibre canvas never became interactive (political layer
//       never loaded or webgl error).
//   4 — right panel never rendered any panel text (data-testid
//       missing or wrong).
//   5 — right panel rendered but only the empty state
//       ("Click any shape"); click did not fire mapSelectedCountry.
//       This is a *different* bug from the one Plan 025 fixes.

import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const BASE_URL = process.env.IXSTATS_VERIFY_URL || "http://localhost:3000";
const EDITOR_URL = `${BASE_URL}/admin/maps/editor`;
const CANVAS_READY_TIMEOUT_MS = 15_000;
const PANEL_ANY_TEXT_TIMEOUT_MS = 5_000;
const PROFILE_TEXT_TIMEOUT_MS = 5_000;

const FAIL_SCREENSHOT_DIR = "/tmp";

function log(...args) {
  console.log("[verify-025]", ...args);
}

async function dumpDiagnostics(page, label) {
  try {
    const titles = await page
      .locator("[data-testid^='editor-']")
      .allTextContents()
      .catch(() => []);
    log(`${label} page.title=`, await page.title());
    log(`${label} editor-* testid text=`, JSON.stringify(titles).slice(0, 800));
  } catch (e) {
    log(`${label} could not dump diagnostics:`, e?.message || e);
  }
}

async function main() {
  // 1. Sanity: dev server reachable.
  try {
    const res = await fetch(EDITOR_URL, { method: "GET" });
    if (!res.ok && res.status !== 304) {
      log(`Dev server returned HTTP ${res.status} for ${EDITOR_URL}`);
      process.exit(2);
    }
  } catch (e) {
    log(`Dev server unreachable at ${EDITOR_URL}: ${e?.message || e}`);
    process.exit(2);
  }

  // 2. Launch browser.
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e) {
    log(`Failed to launch chromium: ${e?.message || e}`);
    log(`If Playwright browsers are missing, run: npx playwright install chromium`);
    process.exit(1);
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => log("pageerror:", e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") log("console.error:", msg.text());
  });

  try {
    log("Navigating to", EDITOR_URL);
    await page.goto(EDITOR_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // 3. Wait for both sidebar testids to mount (editor hydrated).
    await page.waitForSelector('[data-testid="editor-panel-B"]', {
      timeout: 20_000,
    });
    log("editor-panel-B mounted");

    // 4. Wait for the MapLibre canvas to be present and sized.
    const canvasReady = await page
      .waitForFunction(
        () => {
          const c = document.querySelector(".maplibregl-canvas");
          if (!(c instanceof HTMLCanvasElement)) return false;
          const r = c.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        },
        { timeout: CANVAS_READY_TIMEOUT_MS, polling: 250 },
      )
      .then(() => true)
      .catch(() => false);
    if (!canvasReady) {
      log("MapLibre canvas never became interactive");
      await page.screenshot({ path: `${FAIL_SCREENSHOT_DIR}/ixworld-verify-loadfail.png`, fullPage: true });
      await dumpDiagnostics(page, "loadfail");
      process.exit(3);
    }
    log("MapLibre canvas is sized");

    // 5. Optional: read activeSidebarTab hint (does not gate success).
    try {
      const activeTab = await page
        .locator('[data-testid="editor-active-tab"]')
        .first()
        .textContent({ timeout: 1000 });
      if (activeTab) log("editor-active-tab =", activeTab.trim());
    } catch {
      // Not present; that's fine.
    }

    // 6. Click the visible center of the MapLibre canvas.
    const rect = await page.locator(".maplibregl-canvas").first().evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
    const cx = Math.round(rect.x + rect.w / 2);
    const cy = Math.round(rect.y + rect.h / 2);
    log(`Clicking canvas center at (${cx}, ${cy})`);
    await page.mouse.click(cx, cy);

    // 7. Right panel must render *something* (any of: profile, unclaimed,
    //    or the empty state) within PANEL_ANY_TEXT_TIMEOUT_MS.
    const rightPanel = page.locator('[data-testid="editor-panel-B"]');
    const panelAnyText = await rightPanel
      .locator("text=/Country Profile|Unclaimed Territory|Click any shape/i")
      .first()
      .waitFor({ state: "visible", timeout: PANEL_ANY_TEXT_TIMEOUT_MS })
      .then(() => true)
      .catch(() => false);
    if (!panelAnyText) {
      log("Right panel never contained panel text");
      await page.screenshot({
        path: `${FAIL_SCREENSHOT_DIR}/ixworld-verify-no-panel.png`,
        fullPage: true,
      });
      await dumpDiagnostics(page, "no-panel");
      process.exit(4);
    }
    log("Right panel rendered some panel text");

    // 8. Strong assertion: profile or unclaimed text (not the empty state).
    const profileText = await rightPanel
      .locator("text=/Country Profile|Unclaimed Territory/i")
      .first()
      .waitFor({ state: "visible", timeout: PROFILE_TEXT_TIMEOUT_MS })
      .then(() => true)
      .catch(() => false);
    if (!profileText) {
      log("Right panel rendered only the empty state; click did not select a feature");
      await page.screenshot({
        path: `${FAIL_SCREENSHOT_DIR}/ixworld-verify-no-profile.png`,
        fullPage: true,
      });
      await dumpDiagnostics(page, "no-profile");
      process.exit(5);
    }
    log("Right panel shows country profile / unclaimed territory");

    // 9. Success screenshot.
    await page.screenshot({
      path: `${FAIL_SCREENSHOT_DIR}/ixworld-verify-success.png`,
      fullPage: true,
    });

    // 10. Print success marker and exit.
    process.stdout.write("PROPERTIES_PANEL_OK\n");
    process.exit(0);
  } catch (e) {
    log("Unexpected exception:", e?.stack || e?.message || e);
    try {
      await writeFile(
        `${FAIL_SCREENSHOT_DIR}/ixworld-verify-exception.txt`,
        String(e?.stack || e?.message || e),
      );
    } catch {}
    process.exit(1);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

main();
