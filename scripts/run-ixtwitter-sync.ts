#!/usr/bin/env bun
/**
 * IxTwitter Discord → ThinkPages polling sync
 *
 * Runs syncIxTwitterToThinkPages() every 5 minutes via PM2.
 * Handles .ts imports natively via bun.
 *
 * PM2 config: ecosystem.config.cjs (app name: ixstats-ixtwitter)
 */

import { syncIxTwitterToThinkPages } from "../src/lib/discord-ixtwitter-sync";

const INTERVAL_MS = 5 * 60 * 1000;

async function poll() {
  console.log("[IxTwitter] Polling Discord for new messages...");
  try {
    const result = await syncIxTwitterToThinkPages();
    if (result.posted > 0 || result.skipped > 0) {
      console.log(`[IxTwitter] ${result.posted} posted, ${result.skipped} skipped`);
    }
  } catch (error) {
    console.error("[IxTwitter] Sync failed:", error);
  }
}

await poll();
setInterval(poll, INTERVAL_MS);

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
