#!/usr/bin/env node
/**
 * Standalone WebSocket backend.
 *
 * The live preview is served only by the ixworld standalone build (`server.js`),
 * which has NO Socket.IO server attached — so ThinkPages/Intelligence/Market
 * realtime fail. This process runs ONLY the WebSocket servers (no Next, no cron)
 * and nginx proxies the WS paths on maps.ixwiki.com to it, so realtime works
 * same-origin from the browser's point of view.
 *
 * Paths served (attach to the raw HTTP server, independent of Next basePath):
 *   /ws/thinkpages   ThinkPages (Socket.IO)
 *   /socket.io       Intelligence (Socket.IO, default path)
 *   /api/market-ws   Market auctions (ws)
 *
 * Run as PM2 app "ixstats-ws". Cron stays in the separate "ixstats-cron"
 * process — do NOT run full server.mjs here (it would double the cron payouts).
 *
 * NOTE: no top-level await — PM2's Bun fork container `require()`s this file,
 * which fails on top-level await. Everything runs inside main().
 */
import { createServer } from "http";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

function loadEnvVariables() {
  const cwd = process.cwd();
  const mode = process.env.NODE_ENV || "development";
  const envFiles =
    mode === "production"
      ? [".env.production", ".env.local", ".env.production.local"]
      : [".env.local.dev", ".env.local"];
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
      console.warn(`[WS] Failed to load env file ${file}:`, error.message);
    }
  }
}

async function main() {
  loadEnvVariables();
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
    await initializeWebSocketServer(httpServer); // Intelligence (/socket.io) + ThinkPages (/ws/thinkpages)
    console.log("[WS] ✓ Intelligence + ThinkPages WebSocket initialized");
  } catch (error) {
    console.error("[WS] ✗ Intelligence/ThinkPages init failed:", error.message);
  }

  try {
    const { initializeMarketWebSocket } = await import("./src/lib/market-websocket-server.js");
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
