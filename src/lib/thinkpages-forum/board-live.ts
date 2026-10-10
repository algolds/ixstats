/**
 * The realm board's live wire (docs/superpowers/specs/2026-10-10-thinkpages-realm-board-design.md, section 2): the
 * room, the events the Socket.IO server sends to a board's readers, and the pure list merge the client applies to
 * its cached messages. Pure, so the server, the bridge and the client read one definition.
 *
 * Payloads are viewer-independent and persona-safe: no `byViewer`, `canEdit` or `hidden`, and a persona's message
 * carries no player id. A hidden message is never sent; a hide is a `removed` change.
 */
import { z } from "zod";

export const BOARD_ROOM_PREFIX = "realm-board:";
export const boardRoomOf = (realmId: string): string => `${BOARD_ROOM_PREFIX}${realmId}`;

/** A client drops a typing name this long after the last event for it. */
export const BOARD_TYPING_EXPIRY_MS = 5_000;
/** The server relays at most one typing event per user per room in this window. */
export const BOARD_TYPING_THROTTLE_MS = 1_000;
/** Without a live connection the board is polled at this interval. */
export const BOARD_POLL_MS = 10_000;

/** With one, a slow safety poll still covers a publish that never reached the socket server. */
export const BOARD_LIVE_POLL_MS = 60_000;

export const boardRefetchInterval = (live: boolean): number =>
  live ? BOARD_LIVE_POLL_MS : BOARD_POLL_MS;

const authorSchema = z.object({
  name: z.string(),
  handle: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  flagUrl: z.string().nullable(),
  persona: z.boolean(),
});

const realmRefSchema = z.object({ slug: z.string(), name: z.string() });

export const boardLiveMessageSchema = z.object({
  id: z.string(),
  authorUserId: z.string().nullable(),
  authorPersonaId: z.string().nullable(),
  importedAuthorName: z.string().nullable(),
  author: authorSchema,
  role: z.enum(["staff", "officer", "starter"]).nullable(),
  isVisitor: z.boolean(),
  visitorRealm: realmRefSchema.nullable(),
  contentHtml: z.string(),
  /** ISO time. */
  createdAt: z.string(),
  editedAt: z.string().nullable(),
  replyTo: z.object({ postId: z.string(), authorName: z.string(), excerpt: z.string() }).nullable(),
  continued: z
    .object({ threadId: z.string().nullable(), title: z.string(), replies: z.number().nullable() })
    .nullable(),
});
export type BoardLiveMessage = z.infer<typeof boardLiveMessageSchema>;

const changeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("updated"), message: boardLiveMessageSchema }),
  z.object({ type: z.literal("removed"), postId: z.string() }),
]);
export type BoardLiveChange = z.infer<typeof changeSchema>;

/** Every event a board room carries, as the Socket.IO server emits it (the event name is the `type`). */
export const boardLiveEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("board:message"),
    realmId: z.string(),
    message: boardLiveMessageSchema,
  }),
  z.object({ type: z.literal("board:updated"), realmId: z.string(), change: changeSchema }),
  z.object({
    type: z.literal("board:settings"),
    realmId: z.string(),
    settings: z.object({ visitorsAllowed: z.boolean(), slowModeSeconds: z.number() }),
  }),
  z.object({ type: z.literal("board:typing"), realmId: z.string(), name: z.string() }),
  z.object({ type: z.literal("board:presence"), realmId: z.string(), count: z.number() }),
]);
export type BoardLiveEvent = z.infer<typeof boardLiveEventSchema>;

/** The Socket.IO event names of a board room: each event is emitted under its own `type`. */
export const BOARD_EVENT_NAMES = [
  "board:message",
  "board:updated",
  "board:settings",
  "board:typing",
  "board:presence",
] as const satisfies ReadonlyArray<BoardLiveEvent["type"]>;

interface Timed {
  id: string;
  createdAt: Date;
}

/** Whether `a` sorts before `b` in the board's newest-first order (time, then id). */
function isNewer(a: Timed, b: Timed): boolean {
  const [x, y] = [a.createdAt.getTime(), b.createdAt.getTime()];
  return x !== y ? x > y : a.id > b.id;
}

/**
 * The newest-first list with `incoming` merged in by post id: an existing message is replaced in place, a new one
 * slots into its time position. A message older than everything loaded is left to the page that holds it, unless
 * `complete` says the list already holds every older message. Returns the same list when nothing changes.
 */
export function upsertBoardMessage<T extends Timed>(
  list: readonly T[],
  incoming: T,
  opts: { complete: boolean }
): T[] {
  const at = list.findIndex((m) => m.id === incoming.id);
  if (at >= 0) return list.map((m, i) => (i === at ? incoming : m));
  const oldest = list[list.length - 1];
  if (oldest && !opts.complete && isNewer(oldest, incoming)) return list as T[];
  const slot = list.findIndex((m) => isNewer(incoming, m));
  const index = slot < 0 ? list.length : slot;
  return [...list.slice(0, index), incoming, ...list.slice(index)];
}

/** The list without the post; the same list when it was not there. */
export function removeBoardMessage<T extends { id: string }>(
  list: readonly T[],
  postId: string
): T[] {
  return list.some((m) => m.id === postId) ? list.filter((m) => m.id !== postId) : (list as T[]);
}
