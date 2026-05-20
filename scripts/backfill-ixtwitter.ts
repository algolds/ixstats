#!/usr/bin/env bun
/**
 * Backfill IxTwitter Discord channel → ThinkPages
 *
 * Fetches ALL messages from the Discord channel and creates ThinkPages posts
 * for any that haven't been posted yet.
 *
 * Usage: bun run scripts/backfill-ixtwitter.ts
 */

import { backfillIxTwitterToThinkPages } from "../src/lib/discord-ixtwitter-sync";

console.log("=== IxTwitter Backfill ===");
console.log(`Channel: ${process.env.DISCORD_IXTWITTER_CHANNEL_ID || "557223534418722818"}`);
console.log(`Token: ${process.env.DISCORD_BOT_TOKEN ? "SET" : "NOT SET"}`);
console.log("");

const result = await backfillIxTwitterToThinkPages();

console.log("");
console.log("=== Backfill Summary ===");
console.log(`Posted:       ${result.posted}`);
console.log(`Skipped:      ${result.skipped}`);
console.log(`Already done: ${result.alreadyPosted}`);
console.log(`Total:        ${result.posted + result.skipped + result.alreadyPosted}`);
