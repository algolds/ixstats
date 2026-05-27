/**
 * Market WebSocket Server
 *
 * Server-side WebSocket handler for real-time IxCards marketplace updates.
 * Broadcasts bid updates, auction completions, price changes, and new auction
 * listings to connected clients.
 *
 * Uses the `ws` library (not socket.io) for a lightweight transport layer
 * that matches the client's native WebSocket usage.
 *
 * Mounted at /api/market-ws by server.mjs.
 */

import "server-only";
import { Server as HTTPServer, IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";

/** Message types matching the client-side MarketWebSocketMessage union */
interface MarketBroadcast {
  type: "bid" | "auction_complete" | "price_update" | "auction_created";
  data: unknown;
}

interface MarketWSStats {
  connections: number;
  messagesSent: number;
  uptime: number;
  startedAt: number;
}

export class MarketWebSocketServerInstance {
  private wss: WebSocketServer;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private messagesSent = 0;
  private readonly startedAt: number;

  constructor(server: HTTPServer, path: string) {
    this.startedAt = Date.now();

    this.wss = new WebSocketServer({
      server,
      path,
      // Security: limit max payload to 1 MB to prevent DoS
      maxPayload: 1024 * 1024,
    });

    this.setupHandlers();
    this.startHeartbeat();

    console.log(`[MarketWS Server] Initialized at ${path}`);
  }

  /**
   * Set up connection and message handlers
   */
  private setupHandlers(): void {
    this.wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
      // Send a welcome message to confirm the connection
      this.sendToClient(ws, { type: "connected", timestamp: Date.now() });

      ws.on("message", (raw: Buffer | string) => {
        try {
          const message = JSON.parse(typeof raw === "string" ? raw : raw.toString("utf-8"));

          // Handle ping/pong heartbeat from client
          if (message.type === "ping") {
            this.sendToClient(ws, { type: "pong", timestamp: Date.now() });
            return;
          }

          // No other client→server messages are expected at this time;
          // the server is purely a broadcast channel.
        } catch {
          // Malformed JSON — silently ignore
        }
      });

      ws.on("error", (error: Error) => {
        console.error("[MarketWS Server] Client error:", error.message);
      });

      ws.on("close", () => {
        // No-op; the wss.clients Set is maintained by ws automatically
      });
    });

    this.wss.on("error", (error: Error) => {
      console.error("[MarketWS Server] Server error:", error.message);
    });
  }

  /**
   * Broadcast a message to all connected clients
   */
  public broadcast(message: MarketBroadcast): void {
    const payload = JSON.stringify(message);
    let sent = 0;

    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
        sent++;
      }
    }

    this.messagesSent += sent;
  }

  /**
   * Broadcast a new bid event
   */
  public broadcastBid(bid: {
    id: string;
    auctionId: string;
    bidderId: string;
    bidderName: string;
    amount: number;
    timestamp: number;
    isAutoBid: boolean;
  }): void {
    this.broadcast({ type: "bid", data: bid });
  }

  /**
   * Broadcast an auction completion event
   */
  public broadcastAuctionComplete(data: {
    auctionId: string;
    winnerId: string;
    finalPrice: number;
  }): void {
    this.broadcast({ type: "auction_complete", data });
  }

  /**
   * Broadcast a price update event
   */
  public broadcastPriceUpdate(data: { cardId: string; newPrice: number }): void {
    this.broadcast({ type: "price_update", data });
  }

  /**
   * Broadcast a new auction listing event
   */
  public broadcastAuctionCreated(listing: unknown): void {
    this.broadcast({ type: "auction_created", data: listing });
  }

  /**
   * Get server statistics
   */
  public getStats(): MarketWSStats {
    return {
      connections: this.wss.clients.size,
      messagesSent: this.messagesSent,
      uptime: Date.now() - this.startedAt,
      startedAt: this.startedAt,
    };
  }

  /**
   * Start server-side heartbeat to detect dead connections.
   * Pings each client every 30s; terminates if no pong within 35s.
   */
  private startHeartbeat(): void {
    const PING_INTERVAL = 30_000;

    this.heartbeatInterval = setInterval(() => {
      for (const ws of this.wss.clients) {
        if ((ws as any).__isAlive === false) {
          // Did not respond to previous ping — terminate
          ws.terminate();
          continue;
        }
        (ws as any).__isAlive = false;
        ws.ping();
      }
    }, PING_INTERVAL);

    // Mark connections as alive when they respond with pong
    this.wss.on("connection", (ws: WebSocket) => {
      (ws as any).__isAlive = true;
      ws.on("pong", () => {
        (ws as any).__isAlive = true;
      });
    });
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    console.log("[MarketWS Server] Shutting down...");

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all client connections
    for (const client of this.wss.clients) {
      client.close(1001, "Server shutting down");
    }

    // Close the server
    await new Promise<void>((resolve) => {
      this.wss.close(() => {
        console.log("[MarketWS Server] Shutdown complete");
        resolve();
      });
    });
  }

  /**
   * Send a JSON message to a single client
   */
  private sendToClient(ws: WebSocket, data: Record<string, unknown>): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }
}

// ─── Singleton & factory ─────────────────────────────────────────────────────

let instance: MarketWebSocketServerInstance | null = null;

/**
 * Initialize the Market WebSocket server on the given HTTP server.
 * Called by server.mjs during production startup.
 */
export function initializeMarketWebSocket(
  server: HTTPServer,
  path: string = "/api/market-ws"
): MarketWebSocketServerInstance {
  if (instance) {
    console.warn("[MarketWS Server] Already initialized — returning existing instance");
    return instance;
  }

  instance = new MarketWebSocketServerInstance(server, path);
  return instance;
}

/**
 * Get the singleton Market WebSocket server instance.
 * Returns null if not yet initialized.
 */
export function getMarketWebSocketServer(): MarketWebSocketServerInstance | null {
  return instance;
}
