#!/usr/bin/env node
/**
 * Standalone cron runner.
 *
 * Why this exists: the scheduled jobs (passive income, auctions, card values,
 * lore cards, lorewards, trades, sports) historically lived only inside the
 * custom Next server (`server.mjs`). Production is currently served by a plain
 * Next standalone server (no custom server), so `server.mjs`'s cron never ran —
 * passive income / yield boosts never distributed. This process runs the same
 * schedules independently so they fire regardless of how the web app is served.
 *
 * Run as its own PM2 app (see ecosystem.config.cjs → "ixstats-cron").
 *
 * SINGLE OWNER: do not also run `server.mjs` with its inline cron, or daily
 * payouts will double. ixtwitter sync is intentionally omitted here because it
 * already runs as the separate "ixstats-ixtwitter" PM2 process.
 *
 * NOTE: no top-level await — PM2's Bun fork container `require()`s this entry
 * file, which fails on top-level await. Everything runs inside main().
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

function loadEnvVariables() {
  const cwd = process.cwd();
  const mode = process.env.NODE_ENV || "development";
  const envFiles =
    mode === "production" ? [".env.production", ".env.local"] : [".env.local.dev", ".env.local"];
  envFiles.push(".env");

  for (const file of envFiles) {
    const absolutePath = resolve(cwd, file);
    if (!existsSync(absolutePath)) continue;
    try {
      for (const rawLine of readFileSync(absolutePath, "utf8").split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (Object.prototype.hasOwnProperty.call(process.env, key)) continue;
        process.env[key] = value;
      }
    } catch (error) {
      console.warn(`[Cron] Failed to load env file ${file}:`, error.message);
    }
  }
}

function matchCronField(field, value) {
  if (field === "*") return true;
  if (field.includes("/")) {
    const [range, stepStr] = field.split("/");
    const step = parseInt(stepStr, 10);
    if (isNaN(step) || step <= 0) return false;
    let min = 0;
    if (range !== "*") {
      min = parseInt(range, 10) || 0;
    }
    return (value - min) % step === 0 && value >= min;
  }
  if (field.includes(",")) {
    return field.split(",").some((f) => matchCronField(f.trim(), value));
  }
  if (field.includes("-")) {
    const [start, end] = field.split("-").map((v) => parseInt(v, 10));
    return value >= start && value <= end;
  }
  return parseInt(field, 10) === value;
}

function matchesCron(pattern, date = new Date()) {
  const parts = pattern.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [m, h, dom, mon, dow] = parts;

  const minute = date.getUTCMinutes();
  const hour = date.getUTCHours();
  const dayOfMonth = date.getUTCDate();
  const month = date.getUTCMonth() + 1;
  const dayOfWeek = date.getUTCDay();

  return (
    matchCronField(m, minute) &&
    matchCronField(h, hour) &&
    matchCronField(dom, dayOfMonth) &&
    matchCronField(mon, month) &&
    matchCronField(dow, dayOfWeek)
  );
}

async function main() {
  loadEnvVariables();

  // Schedules (overridable via SystemConfig, matching server.mjs)
  let cronSchedule_lorewardsScoring = "0 6 * * *";
  let cronSchedule_passiveIncome = "0 0 * * *";
  let cronSchedule_cardValue = "0 */6 * * *";
  try {
    const { PrismaClient } = await import("@prisma/client");
    const db = new PrismaClient();
    const configs = await db.systemConfig.findMany({
      where: {
        key: {
          in: [
            "cronSchedule_lorewardsScoring",
            "cronSchedule_passiveIncome",
            "cronSchedule_cardValue",
          ],
        },
      },
    });
    for (const c of configs) {
      if (c.key === "cronSchedule_lorewardsScoring" && c.value)
        cronSchedule_lorewardsScoring = c.value.trim();
      else if (c.key === "cronSchedule_passiveIncome" && c.value)
        cronSchedule_passiveIncome = c.value.trim();
      else if (c.key === "cronSchedule_cardValue" && c.value)
        cronSchedule_cardValue = c.value.trim();
    }
    await db.$disconnect();
  } catch (error) {
    console.warn("[Cron] Failed to fetch custom schedules, using defaults:", error.message);
  }

  const isBun = typeof Bun !== "undefined" && typeof Bun.cron === "function";

  const scheduleCron = (name, schedule, handler) => {
    try {
      if (isBun) {
        Bun.cron({
          pattern: schedule,
          run: handler,
        });
        console.log(`[Cron:Bun] ✓ ${name} (${schedule})`);
      } else {
        // Zero-dependency minute polling for fallback Node runtime
        setInterval(() => {
          if (matchesCron(schedule)) {
            handler();
          }
        }, 60000);
        console.log(`[Cron:Native] ✓ ${name} (${schedule})`);
      }
    } catch (error) {
      console.error(`[Cron] ✗ Failed to schedule ${name} (${schedule}):`, error.message);
    }
  };

  scheduleCron("Auction completion", "* * * * *", async () => {
    try {
      const { processExpiredAuctions } = await import("./src/lib/auction-completion-cron.js");
      await processExpiredAuctions();
    } catch (error) {
      console.error("[Cron] Auction completion failed:", error);
    }
  });

  scheduleCron("Passive income distribution", cronSchedule_passiveIncome, async () => {
    try {
      const { distributePassiveIncome } = await import(
        "./src/lib/passive-income-distribution-cron.js"
      );
      await distributePassiveIncome();
    } catch (error) {
      console.error("[Cron] Passive income distribution failed:", error);
    }
  });

  scheduleCron("Card value tracking", cronSchedule_cardValue, async () => {
    try {
      const { updateCardValues } = await import("./src/lib/nation-card-value-update-cron.js");
      await updateCardValues();
    } catch (error) {
      console.error("[Cron] Card value update failed:", error);
    }
  });

  scheduleCron("Lore card generation", "0 2 * * *", async () => {
    try {
      const { generateDailyLoreCards } = await import("./src/lib/lore-card-generation-cron.js");
      await generateDailyLoreCards();
    } catch (error) {
      console.error("[Cron] Lore card generation failed:", error);
    }
  });

  let loreSyncRunning = false;
  scheduleCron("Lorewards fullSync", cronSchedule_lorewardsScoring, async () => {
    if (loreSyncRunning) return;
    loreSyncRunning = true;
    try {
      const { fullSync } = await import("./src/lib/lorewards-sync.js");
      await fullSync();
    } catch (error) {
      console.error("[Cron] Lorewards fullSync failed:", error);
    } finally {
      loreSyncRunning = false;
    }
  });

  // Pull the bot's local state file every 10 min so the calendar tracks the bot
  // without waiting for the daily fullSync. Cheap: local JSON read + upserts, no
  // wiki DB / no stats recompute (fullSync still does the heavy reconciliation).
  let loreStateSyncRunning = false;
  scheduleCron("Lorewards state-file sync", "*/10 * * * *", async () => {
    if (loreStateSyncRunning || loreSyncRunning) return;
    loreStateSyncRunning = true;
    try {
      const { syncFromStateFile } = await import("./src/lib/lorewards-sync.js");
      await syncFromStateFile();
    } catch (error) {
      console.error("[Cron] Lorewards state-file sync failed:", error);
    } finally {
      loreStateSyncRunning = false;
    }
  });

  scheduleCron("Trade expiry", "*/5 * * * *", async () => {
    try {
      const { processExpiredTrades } = await import("./src/lib/trade-expiry-cron.js");
      await processExpiredTrades();
    } catch (error) {
      console.error("[Cron] Trade expiry failed:", error);
    }
  });

  // Every 15 min: the advancer self-gates on each match's scheduledIxTime and
  // no-ops when nothing is due, so a tight tick just trims resolve latency.
  // The reentrancy guard prevents overlap if a run runs long (it shouldn't).
  let sportsAdvanceRunning = false;
  scheduleCron("Sports season auto-advance", "*/15 * * * *", async () => {
    if (sportsAdvanceRunning) return;
    sportsAdvanceRunning = true;
    try {
      const { PrismaClient } = await import("@prisma/client");
      const { advanceSportsSeasons } = await import("./src/lib/sports/season-cron.js");
      const db = new PrismaClient();
      const advanced = await advanceSportsSeasons(db);
      if (advanced > 0) console.log(`[Cron] Sports: advanced ${advanced} seasons`);
      await db.$disconnect();
    } catch (error) {
      console.error("[Cron] Sports season advance failed:", error.message);
    } finally {
      sportsAdvanceRunning = false;
    }
  });

  console.log("[Cron] Standalone cron runner started.");

  // Keep the process alive.
  setInterval(() => {}, 1 << 30);
}

main().catch((error) => {
  console.error("[Cron] Fatal error in cron runner:", error);
  process.exit(1);
});
