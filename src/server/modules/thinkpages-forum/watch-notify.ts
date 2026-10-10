/**
 * Telling a thread's watchers about a reply (spec section 4), with the WikiOS watchlist's rule
 * (`~/lib/wiki-os/services/watchlist-notify.ts`): a watcher is told once until they open the thread again.
 * `ForumThreadWatch.notifiedAt` is the mark. The admin source switch is read first, and when it is off nothing is
 * claimed. Per chunk of watchers the rows of everyone who can read the thread are claimed with one `updateMany` (only
 * those still un-notified), so two replies arriving together tell each watcher once, and the claimed rows are the ones
 * notified. Watchers already told about this post (`handled`) are claimed but not told twice; those who block the
 * author are claimed and not told. If the notices cannot be written the claims are given back. Watchers who cannot
 * read the thread are left alone. The author is never a recipient.
 */
import { recipientsBlockingSender } from "~/server/shared/user-blocks";
import { forumNoticesEnabled, sendForumNotices } from "./forum-notices";
import { readableUsers, RECIPIENT_SELECT, type NoticePlace } from "./notice-recipients";
import { noticeFor } from "./notice-text";
import type { NotifyDb } from "./post-notify";

const CHUNK = 500;

export interface WatchNoticeInput {
  actorId: string;
  actorClerkUserId: string;
  postId: string;
  threadId: string;
  threadTitle: string;
  /** The post author's displayed name: the persona's, else the handle. */
  name: string;
  excerpt: string;
  place: NoticePlace;
  /** Members actually told about this post by a mention, a quote or a reply. */
  handled: ReadonlySet<string>;
}

/** A stamp no other claim made by this process shares, so one claim's rows can be told from a concurrent claim's. */
let lastClaimMs = 0;
function nextClaimStamp(): Date {
  lastClaimMs = Math.max(Date.now(), lastClaimMs + 1);
  return new Date(lastClaimMs);
}

async function ownedBy(
  db: NotifyDb,
  threadId: string,
  userIds: readonly string[],
  stamp: Date
): Promise<Set<string>> {
  const rows = await db.forumThreadWatch.findMany({
    where: { threadId, userId: { in: [...userIds] }, notifiedAt: stamp },
    select: { userId: true },
  });
  return new Set(rows.map((row) => row.userId));
}

async function notifyChunk(
  db: NotifyDb,
  input: WatchNoticeInput,
  userIds: string[]
): Promise<number> {
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: RECIPIENT_SELECT,
  });
  const readable = await readableUsers(db, input.place, users);
  if (readable.length === 0) return 0;
  const blocking = new Set(
    await recipientsBlockingSender(
      db,
      input.actorClerkUserId,
      readable.map((u) => u.clerkUserId)
    )
  );
  const claimIds = readable.map((user) => user.id);
  const stamp = nextClaimStamp();
  const claim = await db.forumThreadWatch.updateMany({
    where: { threadId: input.threadId, userId: { in: claimIds }, notifiedAt: null },
    data: { notifiedAt: stamp },
  });
  if (claim.count === 0) return 0;
  const owned =
    claim.count === claimIds.length
      ? new Set(claimIds)
      : await ownedBy(db, input.threadId, claimIds, stamp);
  const recipients = readable.filter(
    (user) => owned.has(user.id) && !blocking.has(user.clerkUserId) && !input.handled.has(user.id)
  );
  const subject = {
    postId: input.postId,
    threadId: input.threadId,
    threadTitle: input.threadTitle,
    name: input.name,
    excerpt: input.excerpt,
    realmName: input.place.realm?.name ?? "realm",
    board: false,
  };
  if (
    await sendForumNotices(recipients.map((user) => noticeFor("watch", subject, user.clerkUserId)))
  ) {
    return recipients.length;
  }
  await db.forumThreadWatch.updateMany({
    where: { threadId: input.threadId, userId: { in: [...owned] }, notifiedAt: stamp },
    data: { notifiedAt: null },
  });
  return 0;
}

/** Tells every un-notified watcher of the thread who can read it, chunk by chunk; returns how many were told. */
export async function notifyWatchers(db: NotifyDb, input: WatchNoticeInput): Promise<number> {
  // Switched off by an admin: claim nothing, so the watchers are told when it is switched on again.
  if (!(await forumNoticesEnabled())) return 0;
  let told = 0;
  let after = "";
  for (;;) {
    const chunk = await db.forumThreadWatch.findMany({
      where: {
        threadId: input.threadId,
        notifiedAt: null,
        userId: { gt: after, not: input.actorId },
      },
      orderBy: { userId: "asc" },
      take: CHUNK,
      select: { userId: true },
    });
    const last = chunk.at(-1);
    if (!last) return told;
    told += await notifyChunk(
      db,
      input,
      chunk.map((row) => row.userId)
    );
    if (chunk.length < CHUNK) return told;
    after = last.userId;
  }
}
