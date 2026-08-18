// Next.js WebSocket Server Integration
// Integrates WebSocket server with Next.js custom server (server.mjs)

import "server-only";
import type { Server as HTTPServer } from "http";
import type { IntelligenceWebSocketServer } from "~/lib/websocket/intelligence-websocket-server";
import type { ThinkPagesWebSocketServer } from "~/lib/websocket/thinkpages-websocket-server";

// Global instances
let wsServer: IntelligenceWebSocketServer | null = null;
let thinkPagesServer: ThinkPagesWebSocketServer | null = null;

/**
 * Initialize WebSocket server with HTTP server
 */
export async function initializeWebSocketServer(httpServer: HTTPServer): Promise<void> {
  if (wsServer) {
    console.warn("WebSocket server already initialized");
    return;
  }

  console.log("Initializing WebSocket Servers (Intelligence + ThinkPages)...");

  try {
    // Dynamic import to avoid bundling socket.io during build
    const { IntelligenceWebSocketServer } =
      await import("~/lib/websocket/intelligence-websocket-server");
    const { ThinkPagesWebSocketServer } =
      await import("~/lib/websocket/thinkpages-websocket-server");

    // Create WebSocket servers
    wsServer = new IntelligenceWebSocketServer(httpServer);
    thinkPagesServer = new ThinkPagesWebSocketServer(httpServer);

    console.log("WebSocket Servers initialized successfully");

    // Graceful shutdown handling
    process.on("SIGTERM", handleShutdown);
    process.on("SIGINT", handleShutdown);
  } catch (error) {
    console.error("Failed to initialize WebSocket server:", error);
  }
}

/**
 * Get WebSocket server instance
 */
export function getWebSocketServer(): IntelligenceWebSocketServer | null {
  return wsServer;
}

export function getThinkPagesServer(): ThinkPagesWebSocketServer | null {
  return thinkPagesServer;
}

/**
 * Handle graceful shutdown
 */
async function handleShutdown(): Promise<void> {
  console.log("Shutting down WebSocket services...");

  if (wsServer) {
    await wsServer.shutdown();
    wsServer = null;
  }
  if (thinkPagesServer) {
    await thinkPagesServer.shutdown();
    thinkPagesServer = null;
  }

  console.log("WebSocket services shutdown complete");
}
