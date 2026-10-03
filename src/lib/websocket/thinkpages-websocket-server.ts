// ThinkPages WebSocket Server: real-time messaging, presence, typing, read receipts
import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import {
  canJoinConversation,
  canJoinThinktankGroup,
  createSocketAuthMiddleware,
  getPrincipal,
  isOriginAllowed,
} from "./socket-auth";

type ChannelPayload = { channel?: string } | undefined;
type RoomRef = { conversationId?: string; groupId?: string };

const CHANNEL_PATTERN = /^(conversation|group):[A-Za-z0-9_-]{1,64}$/;

function channelFor(payload: RoomRef | undefined): string | undefined {
  if (payload?.conversationId) return `conversation:${payload.conversationId}`;
  if (payload?.groupId) return `group:${payload.groupId}`;
  return undefined;
}

async function canJoinChannel(clerkUserId: string, channel: string): Promise<boolean> {
  const [kind, id] = channel.split(":");
  const check = kind === "conversation" ? canJoinConversation : canJoinThinktankGroup;
  return check(clerkUserId, id).catch(() => false);
}

export interface ThinkPagesMessageEvent {
  type: "message:new" | "message:updated" | "message:deleted";
  conversationId?: string;
  groupId?: string;
  messageId: string;
  accountId: string;
  content?: string;
  timestamp: number;
}

interface ThinkPagesReadReceiptEvent {
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
        origin: (origin, cb) => cb(null, isOriginAllowed(origin)),
        methods: ["GET", "POST"],
        credentials: true,
      },
      // cors only covers long-polling; allowRequest also gates the websocket upgrade
      allowRequest: (req, cb) => cb(null, isOriginAllowed(req.headers.origin)),
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ["websocket", "polling"],
      path: "/ws/thinkpages",
    });
    this.io.use(createSocketAuthMiddleware());
    this.setupHandlers();
  }

  private setupHandlers() {
    this.io.on("connection", (socket: Socket) => {
      const principal = getPrincipal(socket);
      if (!principal) {
        socket.disconnect(true);
        return;
      }
      const accountId = principal.clerkUserId;
      this.clients.set(socket.id, {
        socket,
        accountId,
        subscriptions: new Set(),
        lastSeen: Date.now(),
      });
      socket.emit("authenticated", { success: true, timestamp: Date.now() });

      socket.on("disconnect", () => {
        this.clients.delete(socket.id);
      });

      socket.on("subscribe", (payload: ChannelPayload) => {
        void this.subscribe(socket, accountId, payload?.channel);
      });

      socket.on("unsubscribe", (payload: ChannelPayload) => {
        const c = this.clients.get(socket.id);
        if (!c || typeof payload?.channel !== "string") return;
        c.subscriptions.delete(payload.channel);
        void socket.leave(payload.channel);
      });

      socket.on("presence:update", (payload: { status: string } | undefined) => {
        const c = this.clients.get(socket.id);
        if (!c || !payload) return;
        c.lastSeen = Date.now();
        socket.emit("presence:update", { ...payload, accountId, timestamp: Date.now() });
      });

      socket.on("typing:update", (payload: (RoomRef & { isTyping: boolean }) | undefined) => {
        const channel = channelFor(payload);
        if (!channel || !socket.rooms.has(channel)) return;
        this.io.to(channel).emit("typing:update", { ...payload, accountId, timestamp: Date.now() });
      });

      socket.on("read:receipt", (payload: (RoomRef & { messageId: string }) | undefined) => {
        const channel = channelFor(payload);
        if (!payload || !channel || !socket.rooms.has(channel)) return;
        const event: ThinkPagesReadReceiptEvent = {
          type: "read:receipt",
          accountId,
          conversationId: payload.conversationId,
          groupId: payload.groupId,
          messageId: payload.messageId,
          timestamp: Date.now(),
        };
        this.io.to(channel).emit("read:receipt", event);
      });
    });
  }

  /** Joins a room only after the principal passes the membership check. */
  private async subscribe(socket: Socket, clerkUserId: string, channel: string | undefined) {
    if (typeof channel !== "string" || !CHANNEL_PATTERN.test(channel)) {
      socket.emit("subscribe:error", { channel, reason: "invalid_channel" });
      return;
    }
    const allowed = await canJoinChannel(clerkUserId, channel);
    const c = this.clients.get(socket.id);
    if (!c || !socket.connected) return;
    if (!allowed) {
      socket.emit("subscribe:error", { channel, reason: "forbidden" });
      return;
    }
    c.subscriptions.add(channel);
    await socket.join(channel);
  }

  public broadcastMessage(event: ThinkPagesMessageEvent) {
    const channel = channelFor(event);
    if (!channel) return;
    this.io.to(channel).emit("message:update", {
      type: "message:update",
      data: event,
      timestamp: Date.now(),
      channel,
    });
    // Also notify conversation list to refresh
    if (event.conversationId) {
      this.io.to(channel).emit("conversation:update", {
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
