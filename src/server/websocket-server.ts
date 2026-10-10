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
    const [{ db }, { boardTypingName, canJoinRealmBoard }] = await Promise.all([
      import("~/server/db"),
      import("~/server/modules/thinkpages-forum/board-socket"),
    ]);
    thinkPagesServer = new ThinkPagesWebSocketServer(httpServer, {
      canJoinRealmBoard: (clerkUserId, realmId) => canJoinRealmBoard(db, clerkUserId, realmId),
      boardTypingName: (clerkUserId, personaId) => boardTypingName(db, clerkUserId, personaId),
    });
    // Deliver broadcasts published by other processes (the Next.js web process in production).
    broadcastSubscriber = startThinkPagesBroadcastSubscriber(thinkPagesServer);

    console.log("WebSocket Server initialized successfully");

    process.on("SIGTERM", handleShutdown);
    process.on("SIGINT", handleShutdown);
  } catch (error) {
    console.error("Failed to initialize WebSocket server:", error);
  }
}

/** The local Socket.IO server when this process hosts it, otherwise the Redis publisher. */
export function getThinkPagesBroadcaster(): MessageBroadcaster {
  return thinkPagesServer ?? redisThinkPagesBroadcaster;
}

async function handleShutdown(): Promise<void> {
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
