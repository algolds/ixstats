/**
 * Who may do what in a conversation: which sources take replies, which a user may start, and how the
 * conversation's own participants gate sending, adding and reading.
 */
import type { MessageSource } from "./contracts";
import { MessagingBlockedError, MessagingForbiddenError } from "./errors";

/**
 * Sources a user may start a conversation in. Every other source is written by the server (system notices, the
 * wiki talk bridge, the sports desk, LoreBot, the old forum) and a user-made thread must not pass as one.
 */
const USER_CREATABLE_SOURCES: ReadonlySet<string> = new Set<MessageSource>([
  "thinkshare",
  "diplomatic",
]);

export function assertUserCreatableSource(source: string | undefined): void {
  if (source && !USER_CREATABLE_SOURCES.has(source)) {
    throw new MessagingForbiddenError("You cannot start a conversation in that channel");
  }
}

/** Sources whose threads are server-authored and take no sends, edits, deletes or reactions from a user. */
const READ_ONLY_SOURCES: ReadonlySet<string> = new Set([
  "forum",
  "system",
  "wiki",
  "sports",
  "lorebot",
]);

const READ_ONLY_MESSAGE = "This conversation is read-only";
/** Q14 (phase 4b): conversations imported from the retired XenForo forum keep their history but take no replies. */
const FORUM_READ_ONLY_MESSAGE = "This conversation came from the old forum and is read-only";

/** Nothing in a read-only conversation changes (sends, edits, deletes, reactions). */
export function assertWritableConversation(
  conversation: { source?: string | null } | null | undefined
): void {
  const source = conversation?.source;
  if (!source || !READ_ONLY_SOURCES.has(source)) return;
  throw new MessagingBlockedError(source === "forum" ? FORUM_READ_ONLY_MESSAGE : READ_ONLY_MESSAGE);
}

const PENDING_MESSAGE = "Accept this message request before taking part in the conversation";

/** A recipient holding the conversation as an unanswered request accepts it first; replying does not accept it. */
export function assertNotPending(participant: { requestStatus?: string | null }): void {
  if (participant.requestStatus === "pending") throw new MessagingBlockedError(PENDING_MESSAGE);
}

/** How long after a conversation's creation a participant still counts as one of its original members. */
const ORIGINAL_MEMBER_WINDOW_MS = 5_000;

interface MemberRow {
  userId: string;
  role: string;
  isActive: boolean;
  joinedAt: Date;
}

/**
 * Whether `actorId` may add people to a group: its admins, and the creator (the creator is stored as an admin;
 * a group made before that has no admin, so its original members still can).
 */
export function canManageParticipants(
  conversation: { createdAt: Date; participants: MemberRow[] },
  actorId: string
): boolean {
  const active = conversation.participants.filter((p) => p.isActive);
  const me = active.find((p) => p.userId === actorId);
  if (!me) return false;
  if (me.role === "admin") return true;
  if (active.some((p) => p.role === "admin")) return false;
  return me.joinedAt.getTime() <= conversation.createdAt.getTime() + ORIGINAL_MEMBER_WINDOW_MS;
}

/**
 * Sources whose history starts when a member joined: a person added to a group sees nothing sent before. Imported
 * and server-written threads (forum, wiki, ThinkTank chat) keep their whole history for whoever opens them.
 */
const JOIN_SCOPED_SOURCES: ReadonlySet<string> = new Set(["thinkshare", "diplomatic"]);

/** The earliest time `participant` may read from in `conversation`, or null when they see all of it. */
export function historyStart(
  conversation: { type: string; source?: string | null },
  participant: { joinedAt?: Date | null }
): Date | null {
  if (conversation.type === "direct") return null;
  if (!JOIN_SCOPED_SOURCES.has(conversation.source ?? "thinkshare")) return null;
  return participant.joinedAt ?? null;
}
