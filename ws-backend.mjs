#!/usr/bin/env node
/**
 * Standalone WebSocket backend.
 *
 * The live preview is served only by the ixworld standalone build (`server.js`),
 * which has NO Socket.IO server attached — so ThinkPages/Market
 * realtime fail. This process runs ONLY the WebSocket servers (no Next, no cron)
 * and nginx proxies the WS paths on maps.ixwiki.com to it, so realtime works
 * same-origin from the browser's point of view.
 *
 * Paths served (attach to the raw HTTP server, independent of Next basePath):
 *   /ws/thinkpages   ThinkPages (Socket.IO, Clerk session token required)
 *   /api/market-ws   Market auctions (ws)
 *
 * Run as PM2 app "ixstats-ws". Scheduled jobs run only in the separate
 * "ixstats-cron" process (cron-runner.mjs).
 *
 * Either server failing to start, an unhandled rejection or an uncaught exception
 * exits non-zero, so PM2 restarts the process instead of leaving it half up.
 *
 * NOTE: no top-level await — PM2's Bun fork container `require()`s this file,
 * which fails on top-level await. Everything runs inside main().
 */
import { createServer } from "http";
import { loadEnvVariables } from "./load-env.mjs";

process.on("unhandledRejection", (reason) => {
  console.error("[WS] Unhandled rejection, exiting:", reason);
  process.exit(1);
});
process.on("uncaughtException", (error) => {
  console.error("[WS] Uncaught exception, exiting:", error);
  process.exit(1);
});

async function main() {
  loadEnvVariables("[WS]");
  const port = Number(process.env.WS_BACKEND_PORT || 3551);

  // Plain HTTP server; WS servers hook its "upgrade" event. Non-WS requests get
  // a tiny health response (used by PM2/uptime checks).
  const httpServer = createServer((req, res) => {
    if (req.url === "/healthz") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "ixstats-ws" }));
      return;
    }
    res.writeHead(426, { "content-type": "text/plain" });
    res.end("WebSocket endpoint — upgrade required");
  });

  // This process exists only for these two servers: either failing exits non-zero (PM2 restarts it).
  let shutdownThinkPages;
  try {
    const { initializeWebSocketServer, shutdownWebSocketServer } =
      await import("./src/server/websocket-server.js");
    await initializeWebSocketServer(httpServer); // ThinkPages (/ws/thinkpages)
    shutdownThinkPages = shutdownWebSocketServer;
    console.log("[WS] ✓ ThinkPages WebSocket initialized");
  } catch (error) {
    console.error("[WS] ✗ ThinkPages init failed:", error);
    process.exit(1);
  }

  let market;
  try {
    const { initializeMarketWebSocket } =
      await import("./src/lib/websocket/market-websocket-server.js");
    market = initializeMarketWebSocket(httpServer, "/api/market-ws");
    console.log("[WS] ✓ Market WebSocket initialized at /api/market-ws");
  } catch (error) {
    console.error("[WS] ✗ Market WebSocket init failed:", error);
    process.exit(1);
  }

  httpServer.listen(port, () => {
    console.log(`[WS] Standalone WebSocket backend listening on :${port}`);
  });

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    console.log("[WS] Shutting down...");
    setTimeout(() => process.exit(0), 5000).unref();
    const within = (promise) => Promise.race([promise, new Promise((r) => setTimeout(r, 3000))]);
    await within(market.shutdown()).catch((error) => console.error("[WS] Market close failed:", error));
    await within(shutdownThinkPages()).catch((error) =>
      console.error("[WS] ThinkPages close failed:", error)
    );
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error) => {
  console.error("[WS] Fatal error:", error);
  process.exit(1);
});
