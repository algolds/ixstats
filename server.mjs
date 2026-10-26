#!/usr/bin/env node
/**
 * Custom Next.js Server with WebSocket Support
 * Enables real-time intelligence updates via WebSocket
 */

import { createServer } from "http";
import { parse } from "url";
import { loadEnvVariables } from "./load-env.mjs";
import next from "next";

loadEnvVariables("[Server]");

// A rejection or exception nothing handled leaves the process in an unknown state: log it and exit, PM2 restarts it.
process.on("unhandledRejection", (reason) => {
  console.error("[Server] Unhandled rejection, exiting:", reason);
  process.exit(1);
});
process.on("uncaughtException", (error) => {
  console.error("[Server] Uncaught exception, exiting:", error);
  process.exit(1);
});

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
    let shutdownThinkPages = null;

    // ──────────────────────────────────────────────
    // WebSocket: ThinkPages (production only)
    // ──────────────────────────────────────────────
    try {
      if (dev) {
        subsystems.thinkpagesWS = { status: "disabled", detail: "dev mode" };
        console.log("[Server] ⚠ ThinkPages WebSocket disabled in development mode");
      } else {
        const { initializeWebSocketServer, shutdownWebSocketServer } =
          await import("./src/server/websocket-server.js");
        await initializeWebSocketServer(httpServer);
        shutdownThinkPages = shutdownWebSocketServer;
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
    let shuttingDown = false;
    const shutdown = async () => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log("\n[Server] Graceful shutdown initiated...");

      // Force exit after 10 seconds if graceful shutdown hangs
      setTimeout(() => {
        console.error("[Server] Forced exit after shutdown timeout");
        process.exit(1);
      }, 10000).unref();

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

      // The HTTP server's close ends the process. Listen before step 2, which can start the close itself.
      httpServer.once("close", () => {
        console.log("[Server] HTTP server closed");
        process.exit(0);
      });

      // 2. The ThinkPages Socket.IO server: its open sockets would hold the HTTP server open until the forced exit.
      // Closing it also starts closing the HTTP server.
      try {
        if (shutdownThinkPages) {
          await Promise.race([shutdownThinkPages(), new Promise((r) => setTimeout(r, 3000))]);
          console.log("[Server] ThinkPages WebSocket closed");
        }
      } catch (err) {
        console.error("[Server] Error closing ThinkPages WebSocket:", err.message);
      }

      // 3. Close the HTTP server: it closes once in-flight requests finish; idle keep-alive sockets close now
      if (httpServer.listening) httpServer.close();
      httpServer.closeIdleConnections?.();
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  })
  .catch((err) => {
    console.error("[Server] Fatal error during initialization:", err);
    process.exit(1);
  });
