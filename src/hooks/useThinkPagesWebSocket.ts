import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type {
  // eslint-disable-next-line unused-imports/no-unused-imports
  ThinkPagesWebSocketEvent,
  ThinkPagesClientState,
  ThinkPagesWebSocketHookOptions,
  PresenceUpdate,
  TypingIndicator,
  MessageUpdate,
  ReadReceipt,
} from "~/lib/websocket/thinkpages-types";

const isServer = typeof window === "undefined";

// Initial state factory
const createInitialState = (accountId?: string): ThinkPagesClientState => ({
  connected: false,
  authenticated: false,
  accountId: accountId,
  subscriptions: new Set(),
  presenceStatus: "offline",
  activeConversations: new Set(),
  activeGroups: new Set(),
  typingIndicators: new Map(),
  lastHeartbeat: Date.now(),
});

export function useThinkPagesWebSocket(options: ThinkPagesWebSocketHookOptions) {
  // All hooks must be called unconditionally (Rules of Hooks)
  const [clientState, setClientState] = useState<ThinkPagesClientState>(() =>
    createInitialState(options.accountId)
  );

  const socket = useRef<Socket | null>(null);
  const optionsRef = useRef(options);

  // Update ref when options change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const typingTimeout = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const retryCount = useRef(0);
  const maxRetries = 3;

  // No-op function for SSR
  const noOp = useCallback(() => {}, []);

  const updatePresence = useCallback((status: "online" | "away" | "busy" | "offline") => {
    // Skip on server
    if (isServer) return;

    if (socket.current?.connected && optionsRef.current.accountId) {
      socket.current.emit("presence:update", {
        accountId: optionsRef.current.accountId,
        status,
        timestamp: Date.now(),
      });

      setClientState((prev) => ({ ...prev, presenceStatus: status }));
    }
  }, []);

  const connect = useCallback(() => {
    // Skip on server
    if (isServer) return;

    if (socket.current?.connected) {
      return;
    }

    // Check if WebSocket should be enabled based on environment
    const isProduction = process.env.NODE_ENV === "production";
    const websocketEnabled = process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET === "true";

    if (!isProduction && !websocketEnabled) {
      console.log("[ThinkPagesWebSocket] WebSocket disabled in development mode");
      return;
    }

    // Stop retrying after max attempts
    if (retryCount.current >= maxRetries) {
      console.warn("WebSocket: Max retry attempts reached, disabling real-time features");
      return;
    }

    const wsPort = process.env.NEXT_PUBLIC_WS_PORT || 3001;
    const protocol = window.location.protocol === "https:" ? "https" : "http";
    const host = window.location.host;

    // In production, we connect to the same host but with Socket.IO path
    const url =
      process.env.NODE_ENV === "production"
        ? `${protocol}://${host}`
        : `http://localhost:${wsPort}`;

    socket.current = io(url, {
      path: "/ws/thinkpages",
      transports: ["websocket", "polling"],
      reconnectionAttempts: maxRetries,
      reconnectionDelay: 2000,
    });

    socket.current.on("connect", () => {
      retryCount.current = 0;
      setClientState((prev) => ({ ...prev, connected: true }));

      if (optionsRef.current.accountId) {
        socket.current?.emit("auth", { accountId: optionsRef.current.accountId });
      }

      updatePresence("online");
      optionsRef.current.onConnect?.();
    });

    socket.current.on("authenticated", () => {
      setClientState((prev) => ({ ...prev, authenticated: true }));
    });

    socket.current.on("presence:update", (data: PresenceUpdate) => {
      optionsRef.current.onPresenceUpdate?.(data);
    });

    socket.current.on("typing:update", (data: TypingIndicator) => {
      setClientState((prev) => {
        const newTyping = new Map(prev.typingIndicators);
        const key = `${data.conversationId || data.groupId}_${data.accountId}`;

        if (data.isTyping) {
          newTyping.set(key, data);
          const timeout = setTimeout(() => {
            setClientState((current) => {
              const updatedTyping = new Map(current.typingIndicators);
              updatedTyping.delete(key);
              return { ...current, typingIndicators: updatedTyping };
            });
          }, 3000);

          if (typingTimeout.current.has(key)) {
            clearTimeout(typingTimeout.current.get(key)!);
          }
          typingTimeout.current.set(key, timeout);
        } else {
          newTyping.delete(key);
          if (typingTimeout.current.has(key)) {
            clearTimeout(typingTimeout.current.get(key)!);
            typingTimeout.current.delete(key);
          }
        }
        return { ...prev, typingIndicators: newTyping };
      });
      optionsRef.current.onTypingUpdate?.(data);
    });

    socket.current.on("message:update", (data: MessageUpdate) => {
      optionsRef.current.onMessageUpdate?.(data);
    });

    socket.current.on("read:receipt", (data: ReadReceipt) => {
      optionsRef.current.onReadReceipt?.(data);
    });

    socket.current.on("group:update", (data: any) => {
      optionsRef.current.onGroupUpdate?.(data);
    });

    socket.current.on("conversation:update", (data: any) => {
      optionsRef.current.onConversationUpdate?.(data);
    });

    socket.current.on("disconnect", () => {
      setClientState((prev) => ({ ...prev, connected: false, authenticated: false }));
      optionsRef.current.onDisconnect?.();
    });

    socket.current.on("connect_error", (error) => {
      console.warn(
        "ThinkPages WebSocket connection failed - continuing without real-time features",
        error
      );
      optionsRef.current.onError?.(error);
    });
  }, [updatePresence]);

  const disconnect = useCallback(() => {
    if (isServer) return;

    typingTimeout.current.forEach((timeout) => clearTimeout(timeout));
    typingTimeout.current.clear();

    updatePresence("offline");

    if (socket.current) {
      socket.current.disconnect();
      socket.current = null;
    }
  }, [updatePresence]);
  const sendTypingIndicator = useCallback(
    (conversationId?: string, groupId?: string, isTyping = true) => {
      if (isServer) return;

      if (socket.current?.connected && optionsRef.current.accountId) {
        socket.current.emit("typing:update", {
          accountId: optionsRef.current.accountId,
          conversationId,
          groupId,
          isTyping,
          timestamp: Date.now(),
        });
      }
    },
    []
  );

  const subscribeToConversation = useCallback((conversationId: string) => {
    if (isServer) return;

    if (socket.current?.connected) {
      socket.current.emit("subscribe", {
        channel: `conversation:${conversationId}`,
      });

      setClientState((prev) => ({
        ...prev,
        activeConversations: new Set([...prev.activeConversations, conversationId]),
        subscriptions: new Set([...prev.subscriptions, `conversation:${conversationId}`]),
      }));
    }
  }, []);

  const unsubscribeFromConversation = useCallback((conversationId: string) => {
    if (isServer) return;

    if (socket.current?.connected) {
      socket.current.emit("unsubscribe", {
        channel: `conversation:${conversationId}`,
      });

      setClientState((prev) => {
        const newConversations = new Set(prev.activeConversations);
        const newSubscriptions = new Set(prev.subscriptions);
        newConversations.delete(conversationId);
        newSubscriptions.delete(`conversation:${conversationId}`);

        return {
          ...prev,
          activeConversations: newConversations,
          subscriptions: newSubscriptions,
        };
      });
    }
  }, []);

  const subscribeToGroup = useCallback((groupId: string) => {
    if (isServer) return;

    if (socket.current?.connected) {
      socket.current.emit("subscribe", {
        channel: `group:${groupId}`,
      });

      setClientState((prev) => ({
        ...prev,
        activeGroups: new Set([...prev.activeGroups, groupId]),
        subscriptions: new Set([...prev.subscriptions, `group:${groupId}`]),
      }));
    }
  }, []);

  const markMessageAsRead = useCallback(
    (messageId: string, conversationId?: string, groupId?: string) => {
      if (isServer) return;

      if (socket.current?.connected && optionsRef.current.accountId) {
        socket.current.emit("read:receipt", {
          messageId,
          conversationId,
          groupId,
          accountId: optionsRef.current.accountId,
          readAt: Date.now(),
        });
      }
    },
    []
  );

  // Initialize connection (only runs on client)
  useEffect(() => {
    if (isServer) return;

    if (options.accountId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [options.accountId, connect, disconnect]);

  // Handle visibility change for presence (only on client)
  useEffect(() => {
    if (isServer || typeof document === "undefined") {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        updatePresence("away");
      } else {
        updatePresence("online");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [updatePresence]);

  // Return SSR-safe values on server
  if (isServer) {
    return {
      clientState,
      connect: noOp,
      disconnect: noOp,
      updatePresence: noOp,
      sendTypingIndicator: noOp,
      subscribeToConversation: noOp,
      unsubscribeFromConversation: noOp,
      subscribeToGroup: noOp,
      markMessageAsRead: noOp,
    };
  }

  return {
    clientState,
    connect,
    disconnect,
    updatePresence,
    sendTypingIndicator,
    subscribeToConversation,
    unsubscribeFromConversation,
    subscribeToGroup,
    markMessageAsRead,
  };
}
