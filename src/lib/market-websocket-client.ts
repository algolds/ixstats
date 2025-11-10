// src/lib/market-websocket-client.ts
// WebSocket client for real-time marketplace updates

import type {
  MarketWebSocketMessage,
  Bid,
  AuctionListing,
} from "~/types/marketplace";

type SubscriptionCallback<T> = (data: T) => void;

interface Subscription {
  id: string;
  type: "bid" | "auction_complete" | "price_update" | "auction_created";
  callback: SubscriptionCallback<any>;
  filter?: (data: any) => boolean;
}

/**
 * WebSocket client for marketplace real-time updates
 * Handles reconnection, subscriptions, and message routing
 */
export class MarketWebSocketClient {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, Subscription> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start at 1 second
  private maxReconnectDelay = 30000; // Cap at 30 seconds
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private isIntentionallyClosed = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastPongTime = Date.now();
  private readonly wsUrl: string;

  constructor() {
    // Determine WebSocket URL based on environment
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host =
      process.env.NODE_ENV === "production"
        ? window.location.host
        : "localhost:3000";
    this.wsUrl = `${protocol}//${host}/api/market-ws`;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      console.log("[MarketWS] Already connected or connecting");
      return;
    }

    this.isConnecting = true;
    this.isIntentionallyClosed = false;

    try {
      console.log(`[MarketWS] Connecting to ${this.wsUrl}`);
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
    } catch (error) {
      console.error("[MarketWS] Connection error:", error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;
    this.isConnecting = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.ws) {
      this.ws.close(1000, "Client disconnecting");
      this.ws = null;
    }

    console.log("[MarketWS] Disconnected");
  }

  /**
   * Subscribe to bid updates for specific auction
   */
  subscribeToBid(
    auctionId: string,
    callback: SubscriptionCallback<Bid>
  ): () => void {
    const subscriptionId = `bid-${auctionId}-${Math.random()}`;

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      type: "bid",
      callback,
      filter: (data: Bid) => data.auctionId === auctionId,
    });

    console.log(`[MarketWS] Subscribed to bids for auction ${auctionId}`);

    // Return unsubscribe function
    return () => this.unsubscribe(subscriptionId);
  }

  /**
   * Subscribe to auction completion
   */
  subscribeToAuctionComplete(
    auctionId: string,
    callback: SubscriptionCallback<{
      auctionId: string;
      winnerId: string;
      finalPrice: number;
    }>
  ): () => void {
    const subscriptionId = `complete-${auctionId}-${Math.random()}`;

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      type: "auction_complete",
      callback,
      filter: (data: any) => data.auctionId === auctionId,
    });

    console.log(`[MarketWS] Subscribed to completion for auction ${auctionId}`);

    return () => this.unsubscribe(subscriptionId);
  }

  /**
   * Subscribe to price updates for specific card
   */
  subscribeToPriceUpdates(
    cardId: string,
    callback: SubscriptionCallback<{ cardId: string; newPrice: number }>
  ): () => void {
    const subscriptionId = `price-${cardId}-${Math.random()}`;

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      type: "price_update",
      callback,
      filter: (data: any) => data.cardId === cardId,
    });

    console.log(`[MarketWS] Subscribed to price updates for card ${cardId}`);

    return () => this.unsubscribe(subscriptionId);
  }

  /**
   * Subscribe to new auction creations
   */
  subscribeToNewAuctions(
    callback: SubscriptionCallback<AuctionListing>
  ): () => void {
    const subscriptionId = `new-auction-${Math.random()}`;

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      type: "auction_created",
      callback,
    });

    console.log("[MarketWS] Subscribed to new auctions");

    return () => this.unsubscribe(subscriptionId);
  }

  /**
   * Unsubscribe from updates
   */
  private unsubscribe(subscriptionId: string): void {
    this.subscriptions.delete(subscriptionId);
    console.log(`[MarketWS] Unsubscribed: ${subscriptionId}`);
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection state
   */
  getState(): {
    connected: boolean;
    connecting: boolean;
    reconnectAttempts: number;
    subscriptionCount: number;
  } {
    return {
      connected: this.isConnected(),
      connecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      subscriptionCount: this.subscriptions.size,
    };
  }

  // ============ Private Methods ============

  private handleOpen(): void {
    console.log("[MarketWS] Connected successfully");
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    this.lastPongTime = Date.now();

    // Start heartbeat
    this.startHeartbeat();

    // Re-establish subscriptions if any
    if (this.subscriptions.size > 0) {
      console.log(
        `[MarketWS] Re-establishing ${this.subscriptions.size} subscriptions`
      );
    }
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: MarketWebSocketMessage = JSON.parse(event.data);

      // Handle pong for heartbeat
      if (message.type === ("pong" as any)) {
        this.lastPongTime = Date.now();
        return;
      }

      // Route message to appropriate subscribers
      this.subscriptions.forEach((subscription) => {
        if (subscription.type === message.type) {
          // Apply filter if exists
          if (!subscription.filter || subscription.filter(message.data)) {
            subscription.callback(message.data);
          }
        }
      });
    } catch (error) {
      console.error("[MarketWS] Error parsing message:", error);
    }
  }

  private handleError(event: Event): void {
    console.error("[MarketWS] WebSocket error:", event);
  }

  private handleClose(event: CloseEvent): void {
    console.log(
      `[MarketWS] Connection closed (code: ${event.code}, reason: ${event.reason})`
    );

    this.isConnecting = false;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Reconnect if not intentionally closed
    if (!this.isIntentionallyClosed) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(
        "[MarketWS] Max reconnection attempts reached. Giving up."
      );
      return;
    }

    // Exponential backoff with jitter
    const jitter = Math.random() * 1000;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts) + jitter,
      this.maxReconnectDelay
    );

    console.log(
      `[MarketWS] Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    // Send ping every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));

        // Check if we've received a pong recently (within 45 seconds)
        const timeSinceLastPong = Date.now() - this.lastPongTime;
        if (timeSinceLastPong > 45000) {
          console.warn("[MarketWS] No pong received, reconnecting...");
          this.ws.close();
        }
      }
    }, 30000);
  }
}

// Singleton instance
let marketWsClient: MarketWebSocketClient | null = null;

/**
 * Get or create the singleton WebSocket client
 */
export function getMarketWebSocketClient(): MarketWebSocketClient {
  if (!marketWsClient) {
    marketWsClient = new MarketWebSocketClient();
  }
  return marketWsClient;
}

/**
 * Hook-friendly client factory
 */
export function createMarketWebSocketClient(): MarketWebSocketClient {
  return new MarketWebSocketClient();
}
