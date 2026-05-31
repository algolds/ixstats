/**
 * Real-Time Intelligence Hook
 * Connects to WebSocket server for live intelligence updates
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useUser } from "~/context/auth-context";

interface IntelligenceUpdate {
  type: "intelligence_update" | "connection" | "pong";
  category?: "economic" | "diplomatic" | "government" | "crisis" | "achievement";
  countryId?: string;
  data?: any;
  timestamp?: Date;
  priority?: "low" | "medium" | "high" | "critical";
}

interface ConnectionState {
  status: "connecting" | "connected" | "disconnected" | "error";
  lastUpdate: Date | null;
  reconnectAttempts: number;
}

interface UseRealTimeIntelligenceOptions {
  countryId?: string;
  subscriptions?: string[];
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
}

interface UseRealTimeIntelligenceReturn {
  connectionState: ConnectionState;
  latestUpdate: IntelligenceUpdate | null;
  updates: IntelligenceUpdate[];
  subscribe: (channels: string[]) => void;
  unsubscribe: (channels: string[]) => void;
  clearUpdates: () => void;
  isConnected: boolean;
}

export function useRealTimeIntelligence(
  options: UseRealTimeIntelligenceOptions = {}
): UseRealTimeIntelligenceReturn {
  const { user } = useUser();
  const {
    countryId,
    subscriptions = ["all"],
    autoReconnect = true,
    maxReconnectAttempts = 5,
  } = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: "disconnected",
    lastUpdate: null,
    reconnectAttempts: 0,
  });

  const [latestUpdate, setLatestUpdate] = useState<IntelligenceUpdate | null>(null);
  const [updates, setUpdates] = useState<IntelligenceUpdate[]>([]);

  const socketRef = useRef<Socket | null>(null);

  const connect = useCallback(() => {
    if (!countryId || !user?.id) {
      return;
    }

    if (socketRef.current?.connected) {
      return;
    }

    // Check if WebSocket should be enabled based on environment
    const isProduction = process.env.NODE_ENV === "production";
    const websocketEnabled = process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET === "true";

    if (!isProduction && !websocketEnabled) {
      console.log("[RealTimeIntelligence] WebSocket disabled in development mode");
      return;
    }

    setConnectionState((prev) => ({ ...prev, status: "connecting" }));

    const wsPort = process.env.NEXT_PUBLIC_WS_PORT || 3001;
    const protocol = window.location.protocol === "https:" ? "https" : "http";
    const host = window.location.host;

    const url =
      process.env.NODE_ENV === "production"
        ? `${protocol}://${host}`
        : `http://localhost:${wsPort}`;

    socketRef.current = io(url, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: maxReconnectAttempts,
    });

    socketRef.current.on("connect", () => {
      setConnectionState({
        status: "connected",
        lastUpdate: new Date(),
        reconnectAttempts: 0,
      });

      if (socketRef.current) {
        socketRef.current.emit("authenticate", { userId: user.id, countryId });

        subscriptions.forEach((channel) => {
          if (channel === "all" || channel === "global") {
            socketRef.current?.emit("subscribe:global");
          } else {
            socketRef.current?.emit(`subscribe:${channel}`);
          }
        });
      }
    });

    socketRef.current.on("authenticated", () => {
      setConnectionState((prev) => ({ ...prev, lastUpdate: new Date() }));
    });

    socketRef.current.on("intelligence:update", (data: any) => {
      const update: IntelligenceUpdate = {
        type: "intelligence_update",
        ...data,
        timestamp: new Date(data.timestamp || Date.now()),
      };

      setLatestUpdate(update);
      setConnectionState((prev) => ({ ...prev, lastUpdate: new Date() }));
      setUpdates((prev) => [update, ...prev].slice(0, 50));

      console.log(`📊 Intelligence update: ${update.category} for ${update.countryId}`);
    });

    socketRef.current.on("intelligence:initial", (data: any) => {
      console.log("📥 Initial intelligence received", data);
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("❌ WebSocket error:", error);
      setConnectionState((prev) => ({ ...prev, status: "error" }));
    });

    socketRef.current.on("disconnect", (reason) => {
      console.log("❌ WebSocket connection closed:", reason);
      setConnectionState((prev) => ({ ...prev, status: "disconnected" }));
    });
  }, [
    countryId,
    user?.id,
    subscriptions,
    autoReconnect,
    maxReconnectAttempts,
    connectionState.reconnectAttempts,
  ]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setConnectionState({
      status: "disconnected",
      lastUpdate: null,
      reconnectAttempts: 0,
    });
  }, []);

  const subscribe = useCallback((channels: string[]) => {
    if (socketRef.current?.connected) {
      channels.forEach((channel) => {
        if (channel === "all" || channel === "global") {
          socketRef.current?.emit("subscribe:global");
        } else {
          socketRef.current?.emit(`subscribe:${channel}`);
        }
      });
    }
  }, []);

  const unsubscribe = useCallback((channels: string[]) => {
    if (socketRef.current?.connected) {
      channels.forEach((channel) => {
        socketRef.current?.emit("unsubscribe", channel);
      });
    }
  }, []);

  const clearUpdates = useCallback(() => {
    setUpdates([]);
    setLatestUpdate(null);
  }, []);

  // Connect on mount if we have required data
  useEffect(() => {
    if (countryId && user?.id) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [countryId, user?.id, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    connectionState,
    latestUpdate,
    updates,
    subscribe,
    unsubscribe,
    clearUpdates,
    isConnected: connectionState.status === "connected",
  };
}

/**
 * Hook for specific intelligence categories
 */
export function useRealTimeEconomicIntelligence(countryId?: string) {
  return useRealTimeIntelligence({
    countryId,
    subscriptions: ["economic", "all"],
  });
}

export function useRealTimeDiplomaticIntelligence(countryId?: string) {
  return useRealTimeIntelligence({
    countryId,
    subscriptions: ["diplomatic", "all"],
  });
}

export function useRealTimeCrisisIntelligence(countryId?: string) {
  return useRealTimeIntelligence({
    countryId,
    subscriptions: ["crisis", "all"],
  });
}
