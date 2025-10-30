// ThinkPages WebSocket Server: real-time messaging, presence, typing, read receipts
import "server-only";
import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";

type Subscription = `conversation:${string}` | `group:${string}`;

export interface ThinkPagesMessageEvent {
  type: "message:new" | "message:updated" | "message:deleted";
  conversationId?: string;
  groupId?: string;
  messageId: string;
  accountId: string;
  content?: string;
  timestamp: number;
}

export interface ThinkPagesReadReceiptEvent {
  type: "read:receipt";
  conversationId?: string;
  groupId?: string;
  messageId: string;
  accountId: string;
  timestamp: number;
}

export class ThinkPagesWebSocketServer {
  private io: SocketIOServer;
  private clients = new Map<
    string,
    { socket: Socket; accountId?: string; subscriptions: Set<string>; lastSeen: number }
  >();

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || "*",
        methods: ["GET", "POST"],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ["websocket", "polling"],
      path: "/ws/thinkpages",
    });
    this.setupHandlers();
  }

  private setupHandlers() {
    this.io.on("connection", (socket: Socket) => {
      this.clients.set(socket.id, { socket, subscriptions: new Set(), lastSeen: Date.now() });

      socket.on("disconnect", () => {
        this.clients.delete(socket.id);
      });

      socket.on("auth", (data: { accountId: string }) => {
        const c = this.clients.get(socket.id);
        if (c) {
          c.accountId = data.accountId;
          c.lastSeen = Date.now();
          socket.emit("authenticated", { success: true, timestamp: Date.now() });
        }
      });

      socket.on("subscribe", (payload: { channel: Subscription }) => {
        const c = this.clients.get(socket.id);
        if (!c) return;
        c.subscriptions.add(payload.channel);
        socket.join(payload.channel);
      });

      socket.on("unsubscribe", (payload: { channel: Subscription }) => {
        const c = this.clients.get(socket.id);
        if (!c) return;
        c.subscriptions.delete(payload.channel);
        socket.leave(payload.channel);
      });

      socket.on("presence:update", (payload: { accountId: string; status: string }) => {
        const c = this.clients.get(socket.id);
        if (!c) return;
        c.lastSeen = Date.now();
        socket.emit("presence:update", { ...payload, timestamp: Date.now() });
      });

      socket.on(
        "typing:update",
        (payload: {
          accountId: string;
          conversationId?: string;
          groupId?: string;
          isTyping: boolean;
        }) => {
          const channel = payload.conversationId
            ? (`conversation:${payload.conversationId}` as const)
            : payload.groupId
              ? (`group:${payload.groupId}` as const)
              : undefined;
          if (!channel) return;
          this.io.to(channel).emit("typing:update", { ...payload, timestamp: Date.now() });
        }
      );

      socket.on(
        "read:receipt",
        (payload: {
          accountId: string;
          conversationId?: string;
          groupId?: string;
          messageId: string;
        }) => {
          const event: ThinkPagesReadReceiptEvent = {
            type: "read:receipt",
            accountId: payload.accountId,
            conversationId: payload.conversationId,
            groupId: payload.groupId,
            messageId: payload.messageId,
            timestamp: Date.now(),
          };
          const channel = payload.conversationId
            ? `conversation:${payload.conversationId}`
            : payload.groupId
              ? `group:${payload.groupId}`
              : undefined;
          if (channel) this.io.to(channel).emit("read:receipt", event);
        }
      );
    });
  }

  public broadcastMessage(event: ThinkPagesMessageEvent) {
    const channel = event.conversationId
      ? `conversation:${event.conversationId}`
      : event.groupId
        ? `group:${event.groupId}`
        : undefined;
    if (!channel) return;
    this.io
      .to(channel)
      .emit("message:update", {
        type: "message:update",
        data: event,
        timestamp: Date.now(),
        channel,
      });
    // Also notify conversation list to refresh
    if (event.conversationId) {
      this.io
        .to(channel)
        .emit("conversation:update", {
          type: "conversation:updated",
          conversationId: event.conversationId,
          data: { lastActivity: Date.now() },
          timestamp: Date.now(),
        });
    }
  }

  public getStats() {
    return {
      clients: this.clients.size,
      rooms: this.io.sockets.adapter.rooms.size,
      timestamp: Date.now(),
    };
  }

  public async shutdown() {
    await this.io.close();
  }
}

export type ThinkPagesWSS = ThinkPagesWebSocketServer;
