#!/usr/bin/env node
/**
 * Custom Next.js Server with WebSocket Support
 * Enables real-time intelligence updates via WebSocket
 */

import { createServer } from "http";
import { parse } from "url";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import next from "next";
import { advanceSportsSeasons } from "./src/lib/sports/season-cron.js";

function loadEnvVariables() {
  const envFiles = [];
  const cwd = process.cwd();
  const mode = process.env.NODE_ENV || "development";

  if (mode === "development") {
    envFiles.push(".env.local.dev");
    envFiles.push(".env.local");
  } else if (mode === "production") {
    envFiles.push(".env.production");
    envFiles.push(".env.local");
  }

  envFiles.push(".env");

  for (const file of envFiles) {
    const absolutePath = resolve(cwd, file);
    if (!existsSync(absolutePath)) continue;

    try {
      const content = readFileSync(absolutePath, "utf8");
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;

        const equalsIndex = line.indexOf("=");
        if (equalsIndex === -1) continue;

        const key = line.slice(0, equalsIndex).trim();
        let value = line.slice(equalsIndex + 1).trim();

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
      console.warn(`[Server] Failed to load environment file ${file}:`, error);
    }
  }
}

loadEnvVariables();

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
// Default to port 3550 in production, 3003 for dev to avoid clashing with production
const defaultPort = process.env.NODE_ENV === "production" ? "3550" : "3003";
const port = parseInt(process.env.PORT || defaultPort, 10);

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

console.log("[Server] Initializing IxStats with WebSocket support...");
console.log("[Server] Environment:", process.env.NODE_ENV);
console.log("[Server] Port:", port);

app
  .prepare()
  .then(async () => {
    // Create HTTP server
    const httpServer = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error("[Server] Error handling request:", err);
        res.statusCode = 500;
        res.end("Internal Server Error");
      }
    });

    // ──────────────────────────────────────────────
    // Subsystem status tracking
    // ──────────────────────────────────────────────
    const subsystems = {
      intelligenceWS: { status: "skipped", detail: "" },
      marketWS: { status: "skipped", detail: "" },
      cron: { status: "skipped", detail: "" },
    };
    let marketWsInstance = null;

    // ──────────────────────────────────────────────
    // WebSocket: Intelligence (production only)
    // ──────────────────────────────────────────────
    try {
      if (dev) {
        subsystems.intelligenceWS = { status: "disabled", detail: "dev mode" };
        console.log("[Server] ⚠ Intelligence WebSocket disabled in development mode");
      } else {
        const { initializeWebSocketServer } = await import("./src/server/websocket-server.js");
        await initializeWebSocketServer(httpServer);
        subsystems.intelligenceWS = { status: "ok", detail: "initialized" };
        console.log("[Server] ✓ Intelligence WebSocket initialized");
      }
    } catch (error) {
      subsystems.intelligenceWS = { status: "failed", detail: error.message };
      console.error("[Server] ✗ Intelligence WebSocket initialization failed:", error.message);
      console.warn("[Server] Continuing without Intelligence WebSocket support");
    }

    // ──────────────────────────────────────────────
    // WebSocket: Market (always enabled)
    // ──────────────────────────────────────────────
    try {
      const { initializeMarketWebSocket } = await import("./src/lib/market-websocket-server.js");
      marketWsInstance = initializeMarketWebSocket(httpServer, "/api/market-ws");
      subsystems.marketWS = { status: "ok", detail: "/api/market-ws" };
      console.log("[Server] ✓ Market WebSocket initialized at /api/market-ws");
    } catch (error) {
      subsystems.marketWS = { status: "failed", detail: error.message };
      console.error("[Server] ✗ Market WebSocket initialization failed:", error.message);
      console.warn("[Server] Continuing without Market WebSocket support");
    }

    // ──────────────────────────────────────────────
    // Cron jobs (individually isolated)
    // ──────────────────────────────────────────────
    let cron = null;
    let cronJobsScheduled = 0;
    let cronJobsFailed = 0;

    try {
      cron = await import("node-cron");
    } catch (error) {
      console.error("[Cron] ✗ Failed to import node-cron:", error.message);
      console.warn("[Cron] Continuing without scheduled jobs");
    }

    if (cron) {
      // Fetch cron schedules from database
      let cronSchedule_lorewardsScoring = "0 6 * * *";
      let cronSchedule_passiveIncome = "0 0 * * *";
      let cronSchedule_cardValue = "0 */6 * * *";
      let cronSchedule_wikiRecentChanges = "*/10 * * * *";

      try {
        const { PrismaClient } = await import("@prisma/client");
        const dbInstance = new PrismaClient();
        const configs = await dbInstance.systemConfig.findMany({
          where: {
            key: {
              in: [
                "cronSchedule_lorewardsScoring",
                "cronSchedule_passiveIncome",
                "cronSchedule_cardValue",
                "cronSchedule_wikiRecentChanges",
              ],
            },
          },
        });
        for (const config of configs) {
          if (config.key === "cronSchedule_lorewardsScoring" && config.value) {
            cronSchedule_lorewardsScoring = config.value.trim();
          } else if (config.key === "cronSchedule_passiveIncome" && config.value) {
            cronSchedule_passiveIncome = config.value.trim();
          } else if (config.key === "cronSchedule_cardValue" && config.value) {
            cronSchedule_cardValue = config.value.trim();
          } else if (config.key === "cronSchedule_wikiRecentChanges" && config.value) {
            cronSchedule_wikiRecentChanges = config.value.trim();
          }
        }
        await dbInstance.$disconnect();
      } catch (error) {
        console.warn(
          "[Cron] Failed to fetch custom cron schedules from database, using defaults:",
          error.message
        );
      }

      // Helper: schedule a cron job with isolated error handling
      const scheduleCron = (name, schedule, handler) => {
        try {
          cron.default.schedule(schedule, handler, { timezone: "UTC" });
          cronJobsScheduled++;
          console.log(`[Cron] ✓ ${name} (${schedule})`);
        } catch (error) {
          cronJobsFailed++;
          console.error(`[Cron] ✗ Failed to schedule ${name} (${schedule}):`, error.message);
        }
      };

      // 1. Auction completion (every minute)
      scheduleCron("Auction completion", "* * * * *", async () => {
        try {
          const { processExpiredAuctions } = await import("./src/lib/auction-completion-cron.js");
          await processExpiredAuctions();
        } catch (error) {
          console.error("[Cron] Auction completion failed:", error);
        }
      });

      // 2. Passive income distribution (daily at 00:00 UTC default)
      scheduleCron("Passive income distribution", cronSchedule_passiveIncome, async () => {
        try {
          const { distributePassiveIncome } =
            await import("./src/lib/passive-income-distribution-cron.js");
          await distributePassiveIncome();
        } catch (error) {
          console.error("[Cron] Passive income distribution failed:", error);
        }
      });

      // 3. Card value tracking (every 6 hours default)
      scheduleCron("Card value tracking", cronSchedule_cardValue, async () => {
        try {
          const { updateCardValues } = await import("./src/lib/nation-card-value-update-cron.js");
          await updateCardValues();
        } catch (error) {
          console.error("[Cron] Card value update failed:", error);
        }
      });

      // 4. Lore card generation (daily at 02:00 UTC)
      scheduleCron("Lore card generation", "0 2 * * *", async () => {
        try {
          const { generateDailyLoreCards } = await import("./src/lib/lore-card-generation-cron.js");
          await generateDailyLoreCards();
        } catch (error) {
          console.error("[Cron] Lore card generation failed:", error);
        }
      });

      // 5. IxTwitter Discord sync (every hour)
      scheduleCron("IxTwitter Discord sync", "0 * * * *", async () => {
        try {
          const { syncIxTwitterToThinkPages } = await import("./src/lib/discord/ixtwitter-sync.js");
          const result = await syncIxTwitterToThinkPages();
          if (result.posted > 0) {
            console.log(
              `[Cron] IxTwitter sync: ${result.posted} posted, ${result.skipped} skipped`
            );
          }
        } catch (error) {
          console.error("[Cron] IxTwitter sync failed:", error);
        }
      });

      // 6. Lorewards full sync (daily at 06:00 UTC default)
      let loreSyncRunning = false;
      scheduleCron("Lorewards fullSync", cronSchedule_lorewardsScoring, async () => {
        if (loreSyncRunning) {
          console.log("[Cron] Lorewards fullSync already running, skipping this run");
          return;
        }
        loreSyncRunning = true;
        try {
          const { fullSync } = await import("./src/lib/lorewards-sync.js");
          await fullSync();
          console.log("[Cron] Lorewards fullSync completed successfully");
        } catch (error) {
          console.error("[Cron] Lorewards fullSync failed:", error);
        } finally {
          loreSyncRunning = false;
        }
      });

      // 7. Trade expiry (every 5 minutes)
      scheduleCron("Trade expiry (every 5 minutes)", "*/5 * * * *", async () => {
        try {
          const { processExpiredTrades } = await import("./src/lib/trade-expiry-cron.js");
          await processExpiredTrades();
        } catch (error) {
          console.error("[Cron] Trade expiry failed:", error);
        }
      });

      // 8. Sports season auto-advance (every 15 min; self-gates on scheduledIxTime).
      // ponytail: single-process reentrancy guard. If both this and the standalone
      // cron-runner run, only run sports advance in one (cron-runner owns it).
      let sportsAdvanceRunning = false;
      scheduleCron("Sports Season Auto-Advance", "*/15 * * * *", async () => {
        if (sportsAdvanceRunning) return;
        sportsAdvanceRunning = true;
        try {
          const { PrismaClient } = await import("@prisma/client");
          const db = new PrismaClient();
          const advanced = await advanceSportsSeasons(db);
          if (advanced > 0) {
            console.log(`[Cron] Sports: Advanced ${advanced} seasons`);
          }
          await db.$disconnect();
        } catch (error) {
          console.error("[Cron] Sports season advance failed:", error.message);
        } finally {
          sportsAdvanceRunning = false;
        }
      });

      // 9. National Issues background generation (every 15 minutes; per-country debounced)
      scheduleCron("National Issues generation", "*/15 * * * *", async () => {
        try {
          const { generateNationalIssues } = await import(
            "./src/lib/national-issues-generation-cron.js"
          );
          const r = await generateNationalIssues();
          if (r.issuesGenerated > 0) {
            console.log(
              `[Cron] Issues: generated ${r.issuesGenerated} across ${r.countriesEvaluated} countries`
            );
          }
        } catch (error) {
          console.error("[Cron] National Issues generation failed:", error.message);
        }
      });

      // 10. Scheduled elections (every 10 minutes; resolves due elections on the IxTime clock)
      scheduleCron("Scheduled elections", "*/10 * * * *", async () => {
        try {
          const { processDueElections } = await import("./src/lib/election-cron.js");
          const r = await processDueElections();
          if (r.resolved > 0) {
            console.log(`[Cron] Elections: resolved ${r.resolved}, scheduled ${r.scheduled} next`);
          }
        } catch (error) {
          console.error("[Cron] Scheduled elections failed:", error.message);
        }
      });

      // 11. Politics drift — party support + stability recompute (every 6 hours)
      scheduleCron("Politics drift", "0 */6 * * *", async () => {
        try {
          const { runPoliticsDrift } = await import("./src/lib/politics-drift-cron.js");
          const r = await runPoliticsDrift();
          if (r.partiesUpdated > 0) {
            console.log(
              `[Cron] Politics: ${r.partiesUpdated} parties drifted across ${r.countriesProcessed} countries`
            );
          }
        } catch (error) {
          console.error("[Cron] Politics drift failed:", error.message);
        }
      });

      // 11.5 Diplomatic drift — relation strength adjust based on goals (every 6 hours)
      scheduleCron("Diplomatic drift", "0 */6 * * *", async () => {
        try {
          const { runDiplomaticDrift } = await import("./src/lib/diplomatic-drift-cron.js");
          const r = await runDiplomaticDrift();
          if (r.relationsUpdated > 0) {
            console.log(
              `[Cron] Diplomatic: ${r.relationsUpdated} relations drifted of ${r.relationsProcessed} processed`
            );
          }
        } catch (error) {
          console.error("[Cron] Diplomatic drift failed:", error.message);
        }
      });

      // 11.6 Policy Maintenance Cost — deduct active policy maintenance costs from treasury (every 6 hours)
      scheduleCron("Policy Maintenance Cost", "0 */6 * * *", async () => {
        try {
          const { runPolicyMaintenanceDebits } = await import(
            "./src/lib/policy-maintenance-cron.js"
          );
          const r = await runPolicyMaintenanceDebits();
          if (r.policiesProcessed > 0) {
            console.log(
              `[Cron] Policy Maintenance: debited ${r.totalCostDebited.toLocaleString()} from ${r.countriesProcessed} countries for ${r.policiesProcessed} active policies`
            );
          }
        } catch (error) {
          console.error("[Cron] Policy Maintenance Cost failed:", error.message);
        }
      });

      // 12. WikiOS recentchanges sync (every 10 min default; captures edits made
      //     directly on MediaWiki into the local WikiRevision history)
      scheduleCron("WikiOS recentchanges sync", cronSchedule_wikiRecentChanges, async () => {
        try {
          const { syncWikiRecentChanges } = await import(
            "./src/server/cron/sync-wiki-recentchanges.js"
          );
          const r = await syncWikiRecentChanges();
          if (r.recorded > 0) {
            console.log(
              `[Cron] WikiOS recentchanges: recorded ${r.recorded}, skipped ${r.skipped} of ${r.changesSeen}`
            );
          }
        } catch (error) {
          console.error("[Cron] WikiOS recentchanges sync failed:", error.message);
        }
      });

      subsystems.cron = {
        status: cronJobsFailed === 0 ? "ok" : "partial",
        detail: `${cronJobsScheduled} scheduled, ${cronJobsFailed} failed`,
      };
    }

    // ──────────────────────────────────────────────
    // Start listening
    // ──────────────────────────────────────────────
    await new Promise((resolve) => {
      httpServer.listen(port, () => {
        resolve();
      });
    });

    // ──────────────────────────────────────────────
    // Startup banner
    // ──────────────────────────────────────────────
    const statusIcon = (s) =>
      s === "ok" ? "✓" : s === "failed" ? "✗" : s === "partial" ? "⚠" : "–";
    console.log("");
    console.log("┌─────────────────────────────────────────────────┐");
    console.log("│            IxStats Server — Ready                │");
    console.log("├─────────────────────────────────────────────────┤");
    console.log(`│  URL:              http://${hostname}:${port}`);
    console.log(`│  Environment:      ${process.env.NODE_ENV}`);
    console.log(
      `│  Intelligence WS:  ${statusIcon(subsystems.intelligenceWS.status)} ${subsystems.intelligenceWS.detail}`
    );
    console.log(
      `│  Market WS:        ${statusIcon(subsystems.marketWS.status)} ${subsystems.marketWS.detail}`
    );
    console.log(
      `│  Cron Jobs:        ${statusIcon(subsystems.cron.status)} ${subsystems.cron.detail}`
    );
    console.log("└─────────────────────────────────────────────────┘");
    console.log("");

    // ──────────────────────────────────────────────
    // Graceful shutdown (await WS cleanup)
    // ──────────────────────────────────────────────
    const shutdown = async () => {
      console.log("\n[Server] Graceful shutdown initiated...");

      // 1. Close WebSocket servers first (allows clients to reconnect elsewhere)
      try {
        if (marketWsInstance && typeof marketWsInstance.shutdown === "function") {
          await Promise.race([
            marketWsInstance.shutdown(),
            new Promise((r) => setTimeout(r, 3000)),
          ]);
          console.log("[Server] Market WebSocket closed");
        }
      } catch (err) {
        console.error("[Server] Error closing Market WebSocket:", err.message);
      }

      // 2. Close the HTTP server
      httpServer.close(() => {
        console.log("[Server] HTTP server closed");
        process.exit(0);
      });

      // Force exit after 10 seconds if graceful shutdown hangs
      setTimeout(() => {
        console.error("[Server] Forced exit after shutdown timeout");
        process.exit(1);
      }, 10000).unref();
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  })
  .catch((err) => {
    console.error("[Server] Fatal error during initialization:", err);
    process.exit(1);
  });
