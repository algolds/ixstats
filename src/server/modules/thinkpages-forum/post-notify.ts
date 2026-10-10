/**
 * The notices a saved post causes (spec section 4), sent after the write commits: a mention, a quote of someone's post,
 * a reply on the realm board. (Watchers are `watch-notify.ts`.) One notice per recipient per post: mention, then quote,
 * then reply. Recipients are skipped when they cannot read the post, block its author, or (for mentions) refuse
 * mentions; the author is never told about their own post; nobody is told about a hidden post or an imported one. A
 * persona's post is named by the persona only. Mentions are read only from the links the server made at save
 * (`mentionAnchorNames`), never from the raw text. Never throws: a failure is logged and the post is untouched.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { boardExcerpt } from "~/lib/thinkpages-forum/board";
import { isBoardCategory } from "~/lib/thinkpages-forum/categories";
import { MENTION_MAX_PER_POST } from "~/lib/thinkpages-forum/mentions";
import { quotedPostIds } from "~/lib/thinkpages-forum/post-html";
import { postSummary } from "~/lib/thinkpages-forum/post-summary";
import { recipientsRefusing } from "~/server/shared/privacy-permissions";
import { recipientsBlockingSender } from "~/server/shared/user-blocks";
import { sendForumNotices } from "./forum-notices";
import { mentionAnchorNames } from "./mention-html";
import { resolveMentionNames } from "./mention-links";
import { readableUsers, RECIPIENT_SELECT, type NoticePlace } from "./notice-recipients";
import { noticeFor, type NoticeKind, type NoticeSubject } from "./notice-text";
import { loadForumRealm } from "./realm-access";
import { notifyWatchers } from "./watch-notify";

export type NotifyDb = Pick<
  PrismaClient,
  | "forumPost"
  | "forumThread"
  | "forumPostMention"
  | "forumThreadWatch"
  | "user"
  | "thinkpagesAccount"
  | "userConnection"
  | "countryFollow"
  | "thinkpagesFollow"
  | "realm"
  | "realmOfficer"
  | "forumCategoryModerator"
>;

export interface NoticeActor {
  id: string;
  clerkUserId: string;
}

type Kind = Exclude<NoticeKind, "watch">;
const RANK: Record<Kind, number> = { mention: 3, quote: 2, reply: 1 };

const POST_SELECT = {
  id: true,
  threadId: true,
  authorUserId: true,
  authorPersonaId: true,
  hidden: true,
  sourceRef: true,
  contentHtml: true,
  plainText: true,
  replyToPostId: true,
  thread: {
    select: {
      id: true,
      title: true,
      hidden: true,
      authorUserId: true,
      category: {
        select: { id: true, key: true, style: true, scope: true, realmId: true, visibility: true },
      },
    },
  },
} as const satisfies Prisma.ForumPostSelect;

type NoticePost = Prisma.ForumPostGetPayload<{ select: typeof POST_SELECT }>;

interface NoticeContext {
  place: NoticePlace;
  subject: NoticeSubject;
}

/** Every reason a member has to be told about this post; the strongest that survives their privacy is the notice. */
type Intents = Map<string, Set<Kind>>;

function raise(intents: Intents, userId: string, kind: Kind): void {
  const kinds = intents.get(userId);
  if (kinds) kinds.add(kind);
  else intents.set(userId, new Set([kind]));
}

/** The highest-ranked of `kinds` (mention, then quote, then reply), or null when none is left. */
function strongest(kinds: ReadonlySet<Kind>): Kind | null {
  let best: Kind | null = null;
  for (const kind of kinds) if (best === null || RANK[kind] > RANK[best]) best = kind;
  return best;
}

/** The members the post's own mention links name that it has not mentioned before; records them. */
async function addMentions(
  db: NotifyDb,
  post: NoticePost,
  actor: NoticeActor,
  intents: Intents
): Promise<void> {
  const names = mentionAnchorNames(post.contentHtml).slice(0, MENTION_MAX_PER_POST);
  if (names.length === 0) return;
  const targets = [...(await resolveMentionNames(db, names)).values()];
  const owners = await db.user.findMany({
    where: {
      OR: [
        { id: { in: targets.flatMap((t) => t.userId ?? []) } },
        { clerkUserId: { in: targets.flatMap((t) => t.ownerClerkId ?? []) } },
      ],
    },
    select: { id: true },
  });
  const ids = [...new Set(owners.map((owner) => owner.id))].filter((id) => id !== actor.id);
  if (ids.length === 0) return;
  const known = await db.forumPostMention.findMany({
    where: { postId: post.id, userId: { in: ids } },
    select: { userId: true },
  });
  const seen = new Set(known.map((row) => row.userId));
  const fresh = ids.filter((id) => !seen.has(id));
  if (fresh.length === 0) return;
  await db.forumPostMention.createMany({
    data: fresh.map((userId) => ({ postId: post.id, userId })),
    skipDuplicates: true,
  });
  for (const userId of fresh) raise(intents, userId, "mention");
}

/** The authors of the posts this one quotes: same thread, visible, with an author (a persona post's is its player). */
async function addQuotes(db: NotifyDb, post: NoticePost, intents: Intents): Promise<void> {
  const ids = quotedPostIds(post.contentHtml);
  if (ids.length === 0) return;
  const quoted = await db.forumPost.findMany({
    where: { id: { in: ids }, threadId: post.threadId, hidden: false, authorUserId: { not: null } },
    select: { authorUserId: true },
  });
  for (const row of quoted) if (row.authorUserId) raise(intents, row.authorUserId, "quote");
}

/** The author of the board message this one replies to. */
async function addBoardReply(db: NotifyDb, post: NoticePost, intents: Intents): Promise<void> {
  if (!post.replyToPostId) return;
  const target = await db.forumPost.findUnique({
    where: { id: post.replyToPostId },
    select: { authorUserId: true, hidden: true },
  });
  if (target && !target.hidden && target.authorUserId) raise(intents, target.authorUserId, "reply");
}

/** The name the notice shows: the persona's, else the Passport handle. A persona post never reads its player. */
async function authorName(db: NotifyDb, post: NoticePost): Promise<string> {
  if (post.authorPersonaId) {
    const persona = await db.thinkpagesAccount.findUnique({
      where: { id: post.authorPersonaId },
      select: { displayName: true },
    });
    return persona?.displayName ?? "A persona";
  }
  if (!post.authorUserId) return "Someone";
  const user = await db.user.findUnique({
    where: { id: post.authorUserId },
    select: { handle: true, wikiUsername: true },
  });
  return user?.handle ?? user?.wikiUsername ?? "Member";
}

/**
 * Sends the notices for `intents` and returns the members actually told: not those who cannot read the post, block its
 * author or (for a mention) refuse mentions, and nobody when the write failed. The watcher step tells the rest.
 */
async function deliver(
  db: NotifyDb,
  actor: NoticeActor,
  context: NoticeContext,
  intents: ReadonlyMap<string, ReadonlySet<Kind>>
): Promise<Set<string>> {
  const told = new Set<string>();
  if (intents.size === 0) return told;
  const users = await db.user.findMany({
    where: { id: { in: [...intents.keys()] } },
    select: RECIPIENT_SELECT,
  });
  const readable = await readableUsers(db, context.place, users);
  if (readable.length === 0) return told;
  const mentioned = readable
    .filter((u) => intents.get(u.id)?.has("mention"))
    .map((u) => u.clerkUserId);
  const [blocking, refusing] = await Promise.all([
    recipientsBlockingSender(
      db,
      actor.clerkUserId,
      readable.map((u) => u.clerkUserId)
    ),
    recipientsRefusing(db, actor.clerkUserId, mentioned, "mentions"),
  ]);
  const blocked = new Set(blocking);
  const refusers = new Set(refusing);
  // A member who refuses mentions loses only the mention: a quote or a reply they were owed still reaches them.
  const notices = readable.flatMap((user) => {
    if (blocked.has(user.clerkUserId)) return [];
    const kinds = new Set(intents.get(user.id));
    if (refusers.has(user.clerkUserId)) kinds.delete("mention");
    const kind = strongest(kinds);
    return kind
      ? [{ id: user.id, notice: noticeFor(kind, context.subject, user.clerkUserId) }]
      : [];
  });
  const settled = await sendForumNotices(notices.map((entry) => entry.notice));
  if (settled) for (const entry of notices) told.add(entry.id);
  return told;
}

async function notify(
  db: NotifyDb,
  actor: NoticeActor,
  input: { postId: string; edited: boolean }
): Promise<void> {
  const post = await db.forumPost.findUnique({ where: { id: input.postId }, select: POST_SELECT });
  // Hidden posts, other people's posts and imported ones (no author, or an archive row) tell nobody.
  if (!post || post.hidden || post.thread.hidden || post.sourceRef) return;
  if (!post.authorUserId || post.authorUserId !== actor.id) return;
  const { category } = post.thread;
  const realm =
    category.scope === "realm" && category.realmId
      ? await loadForumRealm(db, { id: category.realmId })
      : null;
  if (category.scope === "realm" && !realm) return;
  const intents: Intents = new Map();
  await addMentions(db, post, actor, intents);
  if (!input.edited) {
    await addQuotes(db, post, intents);
    await addBoardReply(db, post, intents);
  }
  intents.delete(actor.id);
  const board = isBoardCategory(category);
  const context: NoticeContext = {
    place: { thread: post.thread, category, realm },
    subject: {
      postId: post.id,
      threadId: post.threadId,
      threadTitle: post.thread.title,
      name: await authorName(db, post),
      excerpt: boardExcerpt(postSummary(post)),
      realmName: realm?.name ?? "realm",
      board,
    },
  };
  const told = await deliver(db, actor, context, intents);
  // A new reply in a thread reaches its watchers; edits and the board (which nobody watches) do not.
  if (input.edited || board) return;
  const { subject } = context;
  await notifyWatchers(db, {
    actorId: actor.id,
    actorClerkUserId: actor.clerkUserId,
    postId: subject.postId,
    threadId: subject.threadId,
    threadTitle: subject.threadTitle,
    name: subject.name,
    excerpt: subject.excerpt,
    place: context.place,
    handled: told,
  });
}

export async function notifyForumPost(
  db: NotifyDb,
  actor: NoticeActor,
  input: { postId: string; edited: boolean }
): Promise<void> {
  try {
    await notify(db, actor, input);
  } catch (error) {
    console.error("[thinkpages-forum] Post notices failed:", error);
  }
}
