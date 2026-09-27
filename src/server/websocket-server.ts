// Next.js WebSocket Server Integration
// Integrates WebSocket server with Next.js custom server (server.mjs)

import type { Server as HTTPServer } from "http";
import type { ThinkPagesWebSocketServer } from "~/lib/websocket/thinkpages-websocket-server";

// Global instance
let thinkPagesServer: ThinkPagesWebSocketServer | null = null;

/**
 * Initialize WebSocket server with HTTP server
 */
export async function initializeWebSocketServer(httpServer: HTTPServer): Promise<void> {
  if (thinkPagesServer) {
    console.warn("WebSocket server already initialized");
    return;
  }

  console.log("Initializing ThinkPages WebSocket Server...");

  try {
    // Dynamic import to avoid bundling socket.io during build
    const { ThinkPagesWebSocketServer } =
      await import("~/lib/websocket/thinkpages-websocket-server");

    thinkPagesServer = new ThinkPagesWebSocketServer(httpServer);

    console.log("WebSocket Server initialized successfully");

    // Graceful shutdown handling
    process.on("SIGTERM", handleShutdown);
    process.on("SIGINT", handleShutdown);
  } catch (error) {
    console.error("Failed to initialize WebSocket server:", error);
  }
}

export function getThinkPagesServer(): ThinkPagesWebSocketServer | null {
  return thinkPagesServer;
}

/**
 * Handle graceful shutdown
 */
async function handleShutdown(): Promise<void> {
  console.log("Shutting down WebSocket services...");

  if (thinkPagesServer) {
    await thinkPagesServer.shutdown();
    thinkPagesServer = null;
  }

  console.log("WebSocket services shutdown complete");
}
