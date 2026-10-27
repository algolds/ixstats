// Integrates the ThinkPages WebSocket server with the Next.js custom server (server.mjs).

import type { Server as HTTPServer } from "http";
import type { ThinkPagesWebSocketServer } from "~/lib/websocket/thinkpages-websocket-server";
import {
  redisThinkPagesBroadcaster,
  startThinkPagesBroadcastSubscriber,
  type BroadcastSubscriber,
  type MessageBroadcaster,
} from "~/server/thinkpages-broadcast-bridge";

let thinkPagesServer: ThinkPagesWebSocketServer | null = null;
let broadcastSubscriber: BroadcastSubscriber | null = null;

/**
 * Starts the ThinkPages Socket.IO server on `httpServer`. A failure is logged and rethrown, so the caller reports it
 * (ws-backend.mjs exits non-zero for PM2 to restart it; server.mjs carries on without the socket). The caller calls
 * shutdownWebSocketServer() on SIGTERM / SIGINT.
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

    // The socket server (src/lib) cannot import server modules: the forum's board room checks are handed in.
    const [{ db }, { boardTypingName, canJoinRealmBoard, canTypeOnBoard }] = await Promise.all([
      import("~/server/db"),
      import("~/server/modules/thinkpages-forum/board-socket"),
    ]);
    thinkPagesServer = new ThinkPagesWebSocketServer(httpServer, {
      canJoinRealmBoard: (clerkUserId, realmId) => canJoinRealmBoard(db, clerkUserId, realmId),
      canTypeOnBoard: (clerkUserId, realmId) => canTypeOnBoard(db, clerkUserId, realmId),
      boardTypingName: (clerkUserId, personaId) => boardTypingName(db, clerkUserId, personaId),
    });
    // Deliver broadcasts published by other processes (the Next.js web process in production).
    broadcastSubscriber = startThinkPagesBroadcastSubscriber(thinkPagesServer);

    console.log("WebSocket Server initialized successfully");
  } catch (error) {
    console.error("Failed to initialize WebSocket server:", error);
    // Not closed: closing Socket.IO would close the caller's HTTP server too. Broadcasts fall back to Redis.
    thinkPagesServer = null;
    broadcastSubscriber = null;
    throw error;
  }
}

/** The local Socket.IO server when this process hosts it, otherwise the Redis publisher. */
export function getThinkPagesBroadcaster(): MessageBroadcaster {
  return thinkPagesServer ?? redisThinkPagesBroadcaster;
}

/**
 * Closes the broadcast subscriber and the Socket.IO server (which also starts closing the HTTP server it is attached
 * to). A no-op when nothing runs, so calling it twice is safe.
 */
export async function shutdownWebSocketServer(): Promise<void> {
  if (!broadcastSubscriber && !thinkPagesServer) return;
  console.log("Shutting down WebSocket services...");

  if (broadcastSubscriber) {
    await broadcastSubscriber.quit().catch(() => undefined);
    broadcastSubscriber = null;
  }

  if (thinkPagesServer) {
    await thinkPagesServer.shutdown();
    thinkPagesServer = null;
  }

  console.log("WebSocket services shutdown complete");
}
