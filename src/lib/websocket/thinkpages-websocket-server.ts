// ThinkPages WebSocket Server: real-time messaging, presence, typing, read receipts
import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { RealmBoardRooms, type ThinkPagesServerOptions } from "./realm-board-room";
import type { BoardLiveEvent } from "~/lib/thinkpages-forum/board-live";
import {
  canJoinConversation,
  canJoinThinktankGroup,
  createSocketAuthMiddleware,
  getPrincipal,
  isOriginAllowed,
} from "./socket-auth";

export type { ThinkPagesServerOptions } from "./realm-board-room";

type ChannelPayload = { channel?: string } | undefined;
type RoomRef = { conversationId?: string; groupId?: string };
type ChannelKind = "conversation" | "group" | "realm-board";

const CHANNEL_PATTERN = /^(conversation|group|realm-board):([A-Za-z0-9_-]{1,64})$/;

/** Splits a room name into its kind and id; null for anything that is not a room this server knows. */
export function parseChannel(channel: string): { kind: ChannelKind; id: string } | null {
  const match = CHANNEL_PATTERN.exec(channel);
  return match ? { kind: match[1] as ChannelKind, id: match[2]! } : null;
}

function channelFor(payload: RoomRef | undefined): string | undefined {
  if (payload?.conversationId) return `conversation:${payload.conversationId}`;
  if (payload?.groupId) return `group:${payload.groupId}`;
  return undefined;
}

/** The member-gated rooms; board rooms are checked by RealmBoardRooms. */
async function canJoinMemberRoom(
  clerkUserId: string,
  room: { kind: "conversation" | "group"; id: string }
): Promise<boolean> {
  const check = room.kind === "conversation" ? canJoinConversation : canJoinThinktankGroup;
  return check(clerkUserId, room.id).catch(() => false);
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
  private boardRooms: RealmBoardRooms;

  constructor(server: HTTPServer, options: ThinkPagesServerOptions = {}) {
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
    this.boardRooms = new RealmBoardRooms(
      this.io,
      (socketId) => {
        const client = this.clients.get(socketId);
        return client ? (client.accountId ?? null) : undefined;
      },
      options
    );
    this.setupHandlers();
  }

  private setupHandlers() {
    this.io.on("connection", (socket: Socket) => {
      const principal = getPrincipal(socket);
      this.clients.set(socket.id, {
        socket,
        accountId: principal?.clerkUserId,
        subscriptions: new Set(),
        lastSeen: Date.now(),
      });

      socket.on("disconnecting", () => this.boardRooms.left([...socket.rooms]));
      socket.on("disconnect", () => {
        this.clients.delete(socket.id);
      });

      socket.on("subscribe", (payload: ChannelPayload) => {
        const channel = payload?.channel;
        this.subscribe(socket, principal?.clerkUserId ?? null, channel).catch((error: Error) => {
          // A failing check refuses the join the way a denied one does; it never escapes as an unhandled rejection.
          console.error("[ThinkPagesWS] subscribe failed:", error);
          if (socket.connected) socket.emit("subscribe:error", { channel, reason: "forbidden" });
        });
      });

      socket.on("unsubscribe", (payload: ChannelPayload) => {
        const c = this.clients.get(socket.id);
        const channel = payload?.channel;
        if (!c || typeof channel !== "string" || !parseChannel(channel)) return;
        c.subscriptions.delete(channel);
        // Only a room the socket was in changes anything: no presence timer for an arbitrary name.
        if (!socket.rooms.has(channel)) return;
        void socket.leave(channel);
        this.boardRooms.left([channel]);
      });

      // An anonymous reader only subscribes and receives: every emit below needs a verified principal.
      if (!principal) return;
      const accountId = principal.clerkUserId;
      socket.emit("authenticated", { success: true, timestamp: Date.now() });

      socket.on("board:typing", (payload: { realmId?: string; personaId?: string | null }) => {
        void this.boardRooms.relayTyping(socket, accountId, payload);
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

  /**
   * Joins a room only after the viewer passes its check: membership for conversations and groups (signed in), the
   * realm being visible for a board room (signed in or not). An anonymous reader gets board rooms only.
   */
  private async subscribe(socket: Socket, clerkUserId: string | null, channel: string | undefined) {
    const room = typeof channel === "string" ? parseChannel(channel) : null;
    if (typeof channel !== "string" || !room) {
      socket.emit("subscribe:error", { channel, reason: "invalid_channel" });
      return;
    }
    const joined =
      room.kind === "realm-board"
        ? await this.boardRooms.join(socket, clerkUserId, room.id)
        : await this.joinMemberRoom(socket, clerkUserId, channel, room);
    if (!socket.connected) return;
    if (!joined) socket.emit("subscribe:error", { channel, reason: "forbidden" });
    else this.clients.get(socket.id)?.subscriptions.add(channel);
  }

  private async joinMemberRoom(
    socket: Socket,
    clerkUserId: string | null,
    channel: string,
    room: { kind: ChannelKind; id: string }
  ): Promise<boolean> {
    if (!clerkUserId || room.kind === "realm-board") return false;
    const allowed = await canJoinMemberRoom(clerkUserId, { kind: room.kind, id: room.id });
    if (!allowed || !this.clients.has(socket.id) || !socket.connected) return false;
    await socket.join(channel);
    return true;
  }

  /** Emits a realm board event (a message, an update, the settings) to the realm's room. */
  public broadcastBoard(event: BoardLiveEvent) {
    this.boardRooms.broadcast(event);
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
    this.boardRooms.dispose();
    await this.io.close();
  }
}
