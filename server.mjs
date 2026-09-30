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
    // Prod secrets live here (same list as ws-backend.mjs); first file wins.
    envFiles.push(".env.production.local");
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
      thinkpagesWS: { status: "skipped", detail: "" },
      marketWS: { status: "skipped", detail: "" },
    };
    let marketWsInstance = null;

    // ──────────────────────────────────────────────
    // WebSocket: ThinkPages (production only)
    // ──────────────────────────────────────────────
    try {
      if (dev) {
        subsystems.thinkpagesWS = { status: "disabled", detail: "dev mode" };
        console.log("[Server] ⚠ ThinkPages WebSocket disabled in development mode");
      } else {
        const { initializeWebSocketServer } = await import("./src/server/websocket-server.js");
        await initializeWebSocketServer(httpServer);
        subsystems.thinkpagesWS = { status: "ok", detail: "initialized" };
        console.log("[Server] ✓ ThinkPages WebSocket initialized");
      }
    } catch (error) {
      subsystems.thinkpagesWS = { status: "failed", detail: error.message };
      console.error("[Server] ✗ ThinkPages WebSocket initialization failed:", error.message);
      console.warn("[Server] Continuing without ThinkPages WebSocket support");
    }

    // ──────────────────────────────────────────────
    // WebSocket: Market (always enabled)
    // ──────────────────────────────────────────────
    try {
      const { initializeMarketWebSocket } = await import("./src/lib/websocket/market-websocket-server.js");
      marketWsInstance = initializeMarketWebSocket(httpServer, "/api/market-ws");
      subsystems.marketWS = { status: "ok", detail: "/api/market-ws" };
      console.log("[Server] ✓ Market WebSocket initialized at /api/market-ws");
    } catch (error) {
      subsystems.marketWS = { status: "failed", detail: error.message };
      console.error("[Server] ✗ Market WebSocket initialization failed:", error.message);
      console.warn("[Server] Continuing without Market WebSocket support");
    }

    // Scheduled jobs run only in cron-runner.mjs (PM2 app "ixstats-cron"); see src/server/cron/jobs.ts.

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
    const statusIcon = (s) => (s === "ok" ? "✓" : s === "failed" ? "✗" : "–");
    console.log("");
    console.log("┌─────────────────────────────────────────────────┐");
    console.log("│            IxStats Server — Ready                │");
    console.log("├─────────────────────────────────────────────────┤");
    console.log(`│  URL:              http://${hostname}:${port}`);
    console.log(`│  Environment:      ${process.env.NODE_ENV}`);
    console.log(
      `│  ThinkPages WS:    ${statusIcon(subsystems.thinkpagesWS.status)} ${subsystems.thinkpagesWS.detail}`
    );
    console.log(
      `│  Market WS:        ${statusIcon(subsystems.marketWS.status)} ${subsystems.marketWS.detail}`
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
