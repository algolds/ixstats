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
 * NOTE: no top-level await — PM2's Bun fork container `require()`s this file,
 * which fails on top-level await. Everything runs inside main().
 */
import { createServer } from "http";
import { loadEnvVariables } from "./load-env.mjs";

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

  try {
    const { initializeWebSocketServer } = await import("./src/server/websocket-server.js");
    await initializeWebSocketServer(httpServer); // ThinkPages (/ws/thinkpages)
    console.log("[WS] ✓ ThinkPages WebSocket initialized");
  } catch (error) {
    console.error("[WS] ✗ ThinkPages init failed:", error.message);
  }

  try {
    const { initializeMarketWebSocket } =
      await import("./src/lib/websocket/market-websocket-server.js");
    initializeMarketWebSocket(httpServer, "/api/market-ws");
    console.log("[WS] ✓ Market WebSocket initialized at /api/market-ws");
  } catch (error) {
    console.error("[WS] ✗ Market WebSocket init failed:", error.message);
  }

  httpServer.listen(port, () => {
    console.log(`[WS] Standalone WebSocket backend listening on :${port}`);
  });
}

main().catch((error) => {
  console.error("[WS] Fatal error:", error);
  process.exit(1);
});
