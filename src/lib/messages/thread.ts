/**
 * The open conversation's message list as a pure model: ordering, clustering, the optimistic send
 * and its realtime echo, the "Seen" marker, mentions and who is typing. Nothing here knows React or tRPC.
 */

export interface ThreadAccount {
  id: string;
  username: string;
  displayName: string;
  profileImageUrl?: string | null;
  countryFlag?: string | null;
  countryName?: string | null;
  country?: { flag?: string | null; name?: string } | null;
  accountType?: string;
}

export interface ThreadReply {
  id: string;
  accountId?: string;
  account?: ThreadAccount | null;
  content: string;
}

/** A message as the thread renders it: a server row, an optimistic one or one from a realtime event. */
export interface ThreadMessage {
  id: string;
  conversationId: string;
  accountId: string;
  account?: ThreadAccount | null;
  content: string;
  messageType: string;
  ixTimeTimestamp: Date | string;
  createdAt?: Date | string;
  reactions?: Record<string, number>;
  /** The emojis the viewer reacted with. */
  myReactions?: string[];
  editedAt?: Date | string | null;
  deletedAt?: Date | string | null;
  replyTo?: ThreadReply | null;
  classification?: string | null;
  priority?: string | null;
  source?: string | null;
}

interface TimedItem {
  createdAt?: Date | string | null;
  ixTimeTimestamp?: Date | string | null;
}

export const messageTime = (item: TimedItem): number =>
  new Date(item.createdAt ?? item.ixTimeTimestamp ?? 0).getTime();

export const sortByTime = <T extends TimedItem>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => messageTime(a) - messageTime(b));

const TEMP_PREFIX = "temp-";
let tempCounter = 0;

/** A cache id for a message the server has not answered for yet. */
export const newTempMessageId = (): string => `${TEMP_PREFIX}${Date.now()}-${tempCounter++}`;

export const isTempMessageId = (id: string): boolean => id.startsWith(TEMP_PREFIX);

type ClerkLikeUser = {
  username?: string | null;
  fullName?: string | null;
  imageUrl?: string | null;
} | null;

export const ownAccount = (currentUserId: string, user?: ClerkLikeUser): ThreadAccount => ({
  id: currentUserId,
  username: user?.username ?? "me",
  displayName: user?.fullName ?? user?.username ?? "Me",
  profileImageUrl: user?.imageUrl ?? null,
  countryFlag: null,
  countryName: null,
  country: null,
  accountType: "country",
});

/** A cached message row, as inserted optimistically or from a realtime event. */
export function buildMessage(fields: {
  id: string;
  conversationId: string;
  accountId: string;
  account: ThreadAccount;
  content: string;
  messageType: string;
  at: Date;
  replyTo?: ThreadReply | null;
}): ThreadMessage {
  const { at, replyTo, ...rest } = fields;
  return {
    ...rest,
    ixTimeTimestamp: at,
    createdAt: at,
    reactions: {},
    myReactions: [],
    replyTo: replyTo ?? null,
    editedAt: null,
    deletedAt: null,
    source: null,
  };
}

/** Messages from one sender within this gap read as one run. */
const CLUSTER_GAP_MS = 5 * 60 * 1000;

export interface ClusteredMessage<T> {
  message: T;
  /** First of its run: the sender's name goes above it. */
  startsCluster: boolean;
  /** Last of its run: the avatar, the tail and the time go with it. */
  endsCluster: boolean;
}

/** Marks where each run of consecutive messages from the same sender begins and ends. */
export function clusterMessages<T extends TimedItem & { accountId: string }>(
  messages: readonly T[],
  gapMs: number = CLUSTER_GAP_MS
): ClusteredMessage<T>[] {
  const joins = (a: T | undefined, b: T | undefined) =>
    a !== undefined &&
    b !== undefined &&
    a.accountId === b.accountId &&
    messageTime(b) - messageTime(a) < gapMs;
  return messages.map((message, i) => ({
    message,
    startsCluster: !joins(messages[i - 1], message),
    endsCluster: !joins(message, messages[i + 1]),
  }));
}

/** Swaps an optimistic message for what the server stored; drops it when the echo already arrived. */
export function replaceOptimistic<T extends { id: string; ixTimeTimestamp: Date | string }>(
  messages: T[],
  tempId: string,
  saved: { id: string; ixTimeTimestamp: Date | string }
): T[] {
  if (messages.some((m) => m.id === saved.id)) return messages.filter((m) => m.id !== tempId);
  return messages.map((m) =>
    m.id === tempId
      ? {
          ...m,
          id: saved.id,
          ixTimeTimestamp: saved.ixTimeTimestamp,
          createdAt: saved.ixTimeTimestamp,
        }
      : m
  );
}

/**
 * Adds a message that arrived over the socket, once. The sender's own message comes back as an event
 * too: it takes the place of the optimistic copy (which keeps the quoted reply the event lacks).
 */
export function appendIncoming<
  T extends {
    id: string;
    accountId: string;
    content: string;
    account?: unknown;
    replyTo?: unknown;
  },
>(messages: T[], incoming: T, ownerId: string): T[] {
  if (messages.some((m) => m.id === incoming.id)) return messages;
  if (incoming.accountId === ownerId) {
    const pending = messages.findIndex(
      (m) => isTempMessageId(m.id) && m.accountId === ownerId && m.content === incoming.content
    );
    if (pending >= 0) {
      return messages.map((m, i) =>
        i === pending ? { ...incoming, account: m.account, replyTo: m.replyTo } : m
      );
    }
  }
  return [incoming, ...messages];
}

/** One page of a conversation's messages, newest first, with the cursor for the page before it. */
interface MessagePage<T> {
  messages: T[];
  nextCursor?: string | null;
}

interface PagedMessages<T> {
  pages: MessagePage<T>[];
}

type MessageOf<D> = D extends { pages: { messages: (infer M)[] }[] } ? M : never;

/** Applies `update` to every loaded page. */
export function mapPages<D extends PagedMessages<unknown>>(
  data: D,
  update: (messages: MessageOf<D>[]) => MessageOf<D>[]
): NoInfer<D> {
  return {
    ...data,
    pages: data.pages.map((p) => ({ ...p, messages: update(p.messages as MessageOf<D>[]) })),
  };
}

/** Applies `update` to the newest page: where sent and incoming messages land. */
export function mapFirstPage<D extends PagedMessages<unknown>>(
  data: D,
  update: (messages: MessageOf<D>[]) => MessageOf<D>[]
): NoInfer<D> {
  return {
    ...data,
    pages: data.pages.map((p, i) =>
      i === 0 ? { ...p, messages: update(p.messages as MessageOf<D>[]) } : p
    ),
  };
}

/** Every loaded message, oldest first. */
export function flattenPages<T extends TimedItem>(data: PagedMessages<T> | undefined): T[] {
  return sortByTime(data?.pages.flatMap((p) => p.messages) ?? []);
}

/**
 * The newest own message the other person had read when they last opened the thread, so the thread
 * shows one "Seen" under it. Null when read receipts are off or nothing of yours was read.
 */
export function seenMessageId(
  messages: readonly (TimedItem & { id: string; accountId: string })[],
  seenAt: Date | string | null | undefined,
  currentUserId: string
): string | null {
  if (!seenAt) return null;
  const limit = new Date(seenAt).getTime();
  const seen = messages.filter(
    (m) => m.accountId === currentUserId && !isTempMessageId(m.id) && messageTime(m) <= limit
  );
  return seen.at(-1)?.id ?? null;
}

interface Mentionable {
  accountId: string;
  account: { username: string; displayName: string; profileImageUrl?: string | null };
}

/** The server's mention rule: an `@` not preceded by a name character or another `@`. */
const MENTION = /(?<![A-Za-z0-9_@])@([A-Za-z0-9_]{1,40})/g;

/** The members an `@name` in the text points at, as the ids `sendMessage` takes. */
export function mentionIdsFor(plainText: string, members: readonly Mentionable[]): string[] {
  const byName = new Map(members.map((m) => [m.account.username.toLowerCase(), m.accountId]));
  const ids = new Set<string>();
  for (const [, name] of plainText.matchAll(MENTION)) {
    const id = byName.get(name!.toLowerCase());
    if (id) ids.add(id);
  }
  return [...ids];
}

/** The @ menu's rows: the thread's members whose handle or name contains what was typed. */
export function memberMentionItems(members: readonly Mentionable[], query: string, limit = 8) {
  const needle = query.trim().replace(/^@/, "").toLowerCase();
  return members
    .filter(
      ({ account }) =>
        !needle ||
        account.username.toLowerCase().includes(needle) ||
        account.displayName.toLowerCase().includes(needle)
    )
    .slice(0, limit)
    .map(({ account }) => ({
      kind: "user" as const,
      name: account.username,
      label: account.displayName,
      avatarUrl: account.profileImageUrl ?? null,
    }));
}

/** Local effect of reacting, before the server answers; reacting twice or un-reacting nothing changes nothing. */
export function withReaction<T extends Pick<ThreadMessage, "reactions" | "myReactions">>(
  message: T,
  emoji: string,
  on: boolean
): T {
  const mine = message.myReactions ?? [];
  if (mine.includes(emoji) === on) return message;
  const reactions = { ...message.reactions };
  const count = (reactions[emoji] ?? 0) + (on ? 1 : -1);
  if (count > 0) reactions[emoji] = count;
  else delete reactions[emoji];
  return {
    ...message,
    reactions,
    myReactions: on ? [...mine, emoji] : mine.filter((e) => e !== emoji),
  };
}

/** The ids of everyone typing in this thread, other than the viewer. */
export function typingAccountIds(
  indicators: ReadonlyMap<string, { accountId: string; conversationId?: string }>,
  conversationId: string,
  currentUserId: string
): string[] {
  const ids = new Set<string>();
  for (const { accountId, conversationId: where } of indicators.values()) {
    if (where === conversationId && accountId !== currentUserId) ids.add(accountId);
  }
  return [...ids];
}

/** "Ana is typing…", "Ana and Ben are typing…", "Ana and 2 others are typing…"; null when no one is. */
export function typingLabel(names: readonly string[]): string | null {
  const [first, second] = names;
  if (first === undefined) return null;
  if (second === undefined) return `${first} is typing…`;
  if (names.length === 2) return `${first} and ${second} are typing…`;
  return `${first} and ${names.length - 1} others are typing…`;
}
