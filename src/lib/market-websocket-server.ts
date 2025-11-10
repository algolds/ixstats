/**
 * Market WebSocket Server
 *
 * Provides real-time updates for IxCards marketplace
 * - Bid notifications
 * - Auction completion events
 * - Price updates
 * - Subscription management
 *
 * Integration:
 *   import { initializeMarketWebSocket } from '~/lib/market-websocket-server';
 *   // In custom server.js:
 *   const httpServer = createServer(app);
 *   initializeMarketWebSocket(httpServer);
 */

import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";

/**
 * Market client connection
 */
interface MarketClient {
  ws: WebSocket;
  userId?: string;
  subscriptions: Set<string>; // auctionIds
  authenticated: boolean;
}

/**
 * WebSocket message types
 */
type ClientMessage =
  | { type: "subscribe"; auctionId: string }
  | { type: "unsubscribe"; auctionId: string }
  | { type: "auth"; userId: string; token?: string }
  | { type: "ping" };

type ServerMessage =
  | {
      type: "bid";
      auctionId: string;
      bid: {
        bidderId: string;
        bidderClerkId: string;
        amount: number;
        timestamp: number;
      };
    }
  | {
      type: "auction_complete";
      auctionId: string;
      winnerId: string;
      finalPrice: number;
    }
  | {
      type: "auction_extended";
      auctionId: string;
      newEndTime: string;
    }
  | { type: "error"; message: string }
  | { type: "pong" }
  | { type: "subscribed"; auctionId: string }
  | { type: "unsubscribed"; auctionId: string };

/**
 * Market WebSocket Server Class
 */
export class MarketWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, MarketClient> = new Map();
  private auctionSubscribers: Map<string, Set<WebSocket>> = new Map();

  constructor(server: any, path = "/api/market-ws") {
    this.wss = new WebSocketServer({ server, path });

    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    console.log(`[Market WS] WebSocket server initialized at ${path}`);

    // Heartbeat to keep connections alive
    this.startHeartbeat();
  }

  /**
   * Handle new client connection
   */
  private handleConnection(ws: WebSocket, req: IncomingMessage) {
    const clientIp = req.socket.remoteAddress;
    console.log(`[Market WS] New client connected from ${clientIp}`);

    const client: MarketClient = {
      ws,
      subscriptions: new Set(),
      authenticated: false,
    };

    this.clients.set(ws, client);

    // Set up message handler
    ws.on("message", (data: string) => {
      this.handleMessage(client, data);
    });

    // Handle disconnect
    ws.on("close", () => {
      this.handleDisconnect(client);
    });

    // Handle errors
    ws.on("error", (error) => {
      console.error("[Market WS] Client error:", error);
      this.handleDisconnect(client);
    });

    // Send welcome message
    this.send(ws, {
      type: "pong",
    } as ServerMessage);
  }

  /**
   * Handle incoming client messages
   */
  private handleMessage(client: MarketClient, data: string) {
    try {
      const message: ClientMessage = JSON.parse(data);

      switch (message.type) {
        case "subscribe":
          this.handleSubscribe(client, message.auctionId);
          break;

        case "unsubscribe":
          this.handleUnsubscribe(client, message.auctionId);
          break;

        case "auth":
          this.handleAuth(client, message.userId, message.token);
          break;

        case "ping":
          this.send(client.ws, { type: "pong" } as ServerMessage);
          break;

        default:
          console.warn("[Market WS] Unknown message type:", message);
      }
    } catch (error) {
      console.error("[Market WS] Failed to parse message:", error);
      this.send(client.ws, {
        type: "error",
        message: "Invalid message format",
      } as ServerMessage);
    }
  }

  /**
   * Subscribe client to auction updates
   */
  private handleSubscribe(client: MarketClient, auctionId: string) {
    if (!auctionId) {
      this.send(client.ws, {
        type: "error",
        message: "Auction ID is required",
      } as ServerMessage);
      return;
    }

    // Add to client subscriptions
    client.subscriptions.add(auctionId);

    // Add to auction subscribers map
    if (!this.auctionSubscribers.has(auctionId)) {
      this.auctionSubscribers.set(auctionId, new Set());
    }
    this.auctionSubscribers.get(auctionId)!.add(client.ws);

    console.log(`[Market WS] Client subscribed to auction ${auctionId}`);

    this.send(client.ws, {
      type: "subscribed",
      auctionId,
    } as ServerMessage);
  }

  /**
   * Unsubscribe client from auction updates
   */
  private handleUnsubscribe(client: MarketClient, auctionId: string) {
    if (!auctionId) return;

    // Remove from client subscriptions
    client.subscriptions.delete(auctionId);

    // Remove from auction subscribers map
    const subscribers = this.auctionSubscribers.get(auctionId);
    if (subscribers) {
      subscribers.delete(client.ws);
      if (subscribers.size === 0) {
        this.auctionSubscribers.delete(auctionId);
      }
    }

    console.log(`[Market WS] Client unsubscribed from auction ${auctionId}`);

    this.send(client.ws, {
      type: "unsubscribed",
      auctionId,
    } as ServerMessage);
  }

  /**
   * Authenticate client
   * TODO: Integrate with Clerk authentication
   */
  private handleAuth(client: MarketClient, userId: string, token?: string) {
    // For now, simple userId assignment
    // In production, validate token against Clerk
    client.userId = userId;
    client.authenticated = true;
    console.log(`[Market WS] Client authenticated as user ${userId}`);
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(client: MarketClient) {
    console.log(`[Market WS] Client disconnected (user: ${client.userId ?? "anonymous"})`);

    // Remove from all auction subscriptions
    for (const auctionId of client.subscriptions) {
      const subscribers = this.auctionSubscribers.get(auctionId);
      if (subscribers) {
        subscribers.delete(client.ws);
        if (subscribers.size === 0) {
          this.auctionSubscribers.delete(auctionId);
        }
      }
    }

    // Remove from clients map
    this.clients.delete(client.ws);
  }

  /**
   * Send message to specific client
   */
  private send(ws: WebSocket, message: ServerMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error("[Market WS] Failed to send message:", error);
      }
    }
  }

  /**
   * Broadcast bid event to all subscribed clients
   */
  broadcastBid(
    auctionId: string,
    bid: {
      bidderId: string;
      bidderClerkId: string;
      amount: number;
      timestamp: number;
    }
  ) {
    const subscribers = this.auctionSubscribers.get(auctionId);
    if (!subscribers || subscribers.size === 0) {
      return; // No one is watching this auction
    }

    const message: ServerMessage = {
      type: "bid",
      auctionId,
      bid,
    };

    console.log(
      `[Market WS] Broadcasting bid for auction ${auctionId} to ${subscribers.size} clients`
    );

    for (const ws of subscribers) {
      this.send(ws, message);
    }
  }

  /**
   * Broadcast auction completion
   */
  broadcastAuctionComplete(auctionId: string, winnerId: string, finalPrice: number) {
    const subscribers = this.auctionSubscribers.get(auctionId);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const message: ServerMessage = {
      type: "auction_complete",
      auctionId,
      winnerId,
      finalPrice,
    };

    console.log(
      `[Market WS] Broadcasting completion for auction ${auctionId} to ${subscribers.size} clients`
    );

    for (const ws of subscribers) {
      this.send(ws, message);
    }

    // Auto-unsubscribe all clients from completed auction
    this.auctionSubscribers.delete(auctionId);
  }

  /**
   * Broadcast auction time extension
   */
  broadcastAuctionExtended(auctionId: string, newEndTime: string) {
    const subscribers = this.auctionSubscribers.get(auctionId);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const message: ServerMessage = {
      type: "auction_extended",
      auctionId,
      newEndTime,
    };

    console.log(
      `[Market WS] Broadcasting extension for auction ${auctionId} to ${subscribers.size} clients`
    );

    for (const ws of subscribers) {
      this.send(ws, message);
    }
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get subscriber count for auction
   */
  getSubscriberCount(auctionId: string): number {
    return this.auctionSubscribers.get(auctionId)?.size ?? 0;
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      connectedClients: this.clients.size,
      authenticatedClients: Array.from(this.clients.values()).filter((c) => c.authenticated)
        .length,
      activeAuctions: this.auctionSubscribers.size,
      totalSubscriptions: Array.from(this.auctionSubscribers.values()).reduce(
        (sum, subs) => sum + subs.size,
        0
      ),
    };
  }

  /**
   * Heartbeat to detect dead connections
   */
  private startHeartbeat() {
    setInterval(() => {
      for (const [ws, client] of this.clients) {
        if (ws.readyState !== WebSocket.OPEN) {
          this.handleDisconnect(client);
        }
      }
    }, 30000); // Check every 30 seconds
  }
}

/**
 * Global WebSocket server instance
 */
export let marketWsServer: MarketWebSocketServer | null = null;

/**
 * Initialize Market WebSocket server
 *
 * Call this in your custom server.js:
 *
 * ```typescript
 * import { createServer } from 'http';
 * import { initializeMarketWebSocket } from '~/lib/market-websocket-server';
 *
 * const httpServer = createServer(app);
 * initializeMarketWebSocket(httpServer);
 * ```
 */
export function initializeMarketWebSocket(server: any, path?: string) {
  if (marketWsServer) {
    console.warn("[Market WS] WebSocket server already initialized");
    return marketWsServer;
  }

  marketWsServer = new MarketWebSocketServer(server, path);
  console.log("[Market WS] Market WebSocket server initialized");
  return marketWsServer;
}

/**
 * Get current WebSocket server instance
 */
export function getMarketWsServer(): MarketWebSocketServer | null {
  return marketWsServer;
}

/**
 * Example client usage (React/Next.js):
 *
 * ```typescript
 * const ws = new WebSocket('ws://localhost:3000/api/market-ws');
 *
 * ws.onopen = () => {
 *   // Subscribe to auction
 *   ws.send(JSON.stringify({
 *     type: 'subscribe',
 *     auctionId: 'auction_123'
 *   }));
 * };
 *
 * ws.onmessage = (event) => {
 *   const message = JSON.parse(event.data);
 *   if (message.type === 'bid') {
 *     console.log('New bid:', message.bid);
 *     // Update UI
 *   }
 * };
 * ```
 */
