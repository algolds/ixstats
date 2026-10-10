// Realm board rooms on the ThinkPages Socket.IO server: the join check, typing relay and presence counts.
import type { Server as SocketIOServer, Socket } from "socket.io";
import {
  BOARD_ROOM_PREFIX,
  BOARD_TYPING_THROTTLE_MS,
  boardRoomOf,
  type BoardLiveEvent,
} from "~/lib/thinkpages-forum/board-live";

/** What the forum answers about a board room (src/server/modules/thinkpages-forum/board-socket.ts). */
export interface ThinkPagesServerOptions {
  /** Whether the viewer (a Clerk id, null when signed out) may join the realm's room: the realm is visible to them. */
  canJoinRealmBoard?: (clerkUserId: string | null, realmId: string) => Promise<boolean>;
  /** The persona-safe name a typing indicator shows, or null to drop it (the persona is not the user's own). */
  boardTypingName?: (clerkUserId: string, personaId: string | null) => Promise<string | null>;
  /** Presence events for a room are coalesced into one per this many ms. */
  presenceDelayMs?: number;
}

const DEFAULT_PRESENCE_DELAY_MS = 1_000;
const MAX_ID_LENGTH = 64;
/** A socket reads at most this many boards at once; an anonymous reader costs a database check per join. */
const MAX_BOARD_ROOMS_PER_SOCKET = 5;
const PRUNE_ABOVE = 500;

/** Allows one event per key per window; forgets idle keys once the map grows. */
export class TypingThrottle {
  private last = new Map<string, number>();

  constructor(private windowMs = BOARD_TYPING_THROTTLE_MS) {}

  allow(key: string, now: number): boolean {
    const previous = this.last.get(key);
    if (previous !== undefined && now - previous < this.windowMs) return false;
    this.last.set(key, now);
    if (this.last.size > PRUNE_ABOVE) this.prune(now);
    return true;
  }

  private prune(now: number): void {
    for (const [key, at] of this.last) if (now - at >= this.windowMs) this.last.delete(key);
  }
}

interface TypingPayload {
  realmId?: string;
  personaId?: string | null;
}

const idOf = (value: string | null | undefined): string | null =>
  typeof value === "string" && value.length > 0 && value.length <= MAX_ID_LENGTH ? value : null;

export class RealmBoardRooms {
  private throttle = new TypingThrottle();
  private timers = new Map<string, NodeJS.Timeout>();
  private names = new WeakMap<Socket, Map<string, string>>();

  constructor(
    private io: SocketIOServer,
    /** The Clerk id of a connected socket, null for an anonymous one, undefined for one no longer tracked. */
    private accountOf: (socketId: string) => string | null | undefined,
    private options: ThinkPagesServerOptions
  ) {}

  /** Joins the realm's room when the forum says the viewer may see the realm; false otherwise. */
  async join(socket: Socket, clerkUserId: string | null, realmId: string): Promise<boolean> {
    const room = boardRoomOf(realmId);
    if (socket.rooms.has(room)) return true;
    const joinedBoards = [...socket.rooms].filter((r) => r.startsWith(BOARD_ROOM_PREFIX)).length;
    if (joinedBoards >= MAX_BOARD_ROOMS_PER_SOCKET) return false;
    const check = this.options.canJoinRealmBoard;
    const allowed = check ? await check(clerkUserId, realmId).catch(() => false) : false;
    if (!allowed || !socket.connected) return false;
    await socket.join(room);
    // The joiner hears the count at once (it also confirms the join); the room's follows, coalesced.
    socket.emit("board:presence", this.presenceEvent(room));
    this.schedulePresence(room);
    return true;
  }

  /** Rooms a socket left or is leaving: their counts change. */
  left(rooms: Iterable<string>): void {
    for (const room of rooms) if (room.startsWith(BOARD_ROOM_PREFIX)) this.schedulePresence(room);
  }

  /** Relays a typing indicator to the room's other sockets under the server-resolved name. */
  async relayTyping(socket: Socket, clerkUserId: string, payload: TypingPayload | undefined) {
    const realmId = idOf(payload?.realmId);
    if (!realmId) return;
    const room = boardRoomOf(realmId);
    if (!socket.rooms.has(room)) return;
    if (!this.throttle.allow(`${clerkUserId}|${room}`, Date.now())) return;
    const name = await this.typingName(socket, clerkUserId, idOf(payload?.personaId));
    if (!name || !socket.connected) return;
    const event: BoardLiveEvent = { type: "board:typing", realmId, name };
    socket.to(room).emit("board:typing", event);
  }

  /** Sends a board event to the realm's room. */
  broadcast(event: BoardLiveEvent): void {
    this.io.to(boardRoomOf(event.realmId)).emit(event.type, event);
  }

  dispose(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  private async typingName(
    socket: Socket,
    clerkUserId: string,
    personaId: string | null
  ): Promise<string | null> {
    const cache = this.names.get(socket) ?? new Map<string, string>();
    this.names.set(socket, cache);
    const key = personaId ?? "";
    const cached = cache.get(key);
    if (cached) return cached;
    const resolve = this.options.boardTypingName;
    const name = resolve ? await resolve(clerkUserId, personaId).catch(() => null) : null;
    if (name) cache.set(key, name);
    return name;
  }

  /** Distinct signed-in users plus each anonymous socket. */
  private countIn(room: string): number {
    const users = new Set<string>();
    let anonymous = 0;
    for (const socketId of this.io.sockets.adapter.rooms.get(room) ?? []) {
      const account = this.accountOf(socketId);
      if (account) users.add(account);
      else if (account === null) anonymous += 1;
    }
    return users.size + anonymous;
  }

  private presenceEvent(room: string): BoardLiveEvent {
    return {
      type: "board:presence",
      realmId: room.slice(BOARD_ROOM_PREFIX.length),
      count: this.countIn(room),
    };
  }

  private schedulePresence(room: string): void {
    if (this.timers.has(room)) return;
    const timer = setTimeout(() => {
      this.timers.delete(room);
      this.io.to(room).emit("board:presence", this.presenceEvent(room));
    }, this.options.presenceDelayMs ?? DEFAULT_PRESENCE_DELAY_MS);
    timer.unref();
    this.timers.set(room, timer);
  }
}
