/**
 * A realm board message as the page and the live socket carry it. Built from board posts with the same persona rule
 * as a thread page: a persona's message names the persona only (no player id for anyone but a moderator, no player
 * flag, avatar, role or visitor label). A visitor is an author with no nation in the realm; their label is their own
 * primary realm. Hidden messages reach moderators only (the callers' queries), flagged.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { BOARD_EDIT_WINDOW_MS, boardExcerpt } from "~/lib/thinkpages-forum/board";
import { primaryNationOf } from "~/lib/realms/primary-nation";
import type { ForumViewer } from "./access";
import { canSeeRealm, loadForumRealm, type ForumRealm } from "./realm-access";
import { authorsOf, type AuthorsDb } from "./reads";
import { roleContextOf, roleOf, type PostRole } from "./thread-extras";

export type BoardMessageDb = AuthorsDb &
  Pick<PrismaClient, "forumPost" | "forumThread" | "country" | "realm" | "realmOfficer">;

/** What the board shows of an author: the persona, else the player, else the imported name. */
export interface BoardMessageAuthor {
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  flagUrl: string | null;
  persona: boolean;
}

export interface BoardMessage {
  id: string;
  /** Null for a persona's message unless the viewer moderates the board. */
  authorUserId: string | null;
  authorPersonaId: string | null;
  importedAuthorName: string | null;
  author: BoardMessageAuthor;
  role: PostRole | null;
  isVisitor: boolean;
  /** The visitor's own realm; null for members, and for a visitor with no nation. */
  visitorRealm: { slug: string; name: string } | null;
  contentHtml: string;
  createdAt: Date;
  editedAt: Date | null;
  /** Present for moderators only: the message is hidden from everyone else. */
  hidden?: boolean;
  byViewer: boolean;
  /** The viewer wrote it and it is within the edit window (the server asks again on edit). */
  canEdit: boolean;
  replyTo: { postId: string; authorName: string; excerpt: string } | null;
  continued: { threadId: string; title: string; replies: number } | null;
}

export const BOARD_POST_SELECT = {
  id: true,
  authorUserId: true,
  authorPersonaId: true,
  importedAuthorName: true,
  contentHtml: true,
  createdAt: true,
  editedAt: true,
  hidden: true,
  replyToPostId: true,
  continuedThreadId: true,
} as const satisfies Prisma.ForumPostSelect;

export type BoardRow = Prisma.ForumPostGetPayload<{ select: typeof BOARD_POST_SELECT }>;

/** The board a message list belongs to. */
export interface BoardPlace {
  realm: ForumRealm;
  threadId: string;
  category: { id: string; scope: string; realmId: string | null };
  /** The viewer moderates the board: sees hidden messages, flagged, and a persona's player. */
  canModerate: boolean;
}

interface AuthorRow {
  authorUserId: string | null;
  authorPersonaId: string | null;
  importedAuthorName: string | null;
}

type AuthorMaps = Awaited<ReturnType<typeof authorsOf>>;

function authorOf(row: AuthorRow, maps: AuthorMaps): BoardMessageAuthor {
  if (row.authorPersonaId) {
    const persona = maps.personas.get(row.authorPersonaId);
    return {
      name: persona?.displayName ?? "Persona",
      handle: persona?.username ?? null,
      avatarUrl: persona?.avatarUrl ?? null,
      flagUrl: null,
      persona: true,
    };
  }
  const user = row.authorUserId ? maps.users.get(row.authorUserId) : undefined;
  if (user) return { ...user, persona: false };
  return {
    name: row.importedAuthorName ?? "Member",
    handle: null,
    avatarUrl: null,
    flagUrl: null,
    persona: false,
  };
}

const playerIds = (rows: readonly AuthorRow[]): string[] =>
  rows.flatMap((r) => (r.authorPersonaId === null && r.authorUserId ? [r.authorUserId] : []));

/**
 * The visitor label of each player author that is not a member of the realm (no nation in it, not its founder):
 * their own primary realm, or null when they hold none or it is hidden from readers.
 */
async function visitorRealms(
  db: BoardMessageDb,
  realm: ForumRealm,
  userIds: readonly string[]
): Promise<Map<string, { slug: string; name: string } | null>> {
  const visitors = new Map<string, { slug: string; name: string } | null>();
  if (userIds.length === 0) return visitors;
  const [users, nations] = await Promise.all([
    db.user.findMany({
      where: { id: { in: [...userIds] } },
      select: { id: true, clerkUserId: true, countryId: true },
    }),
    db.country.findMany({
      where: { ownerUserId: { in: [...userIds] } },
      select: { id: true, ownerUserId: true, realmId: true, currentTotalGdp: true },
    }),
  ]);
  const primaryRealmId = new Map<string, string | null>();
  for (const user of users) {
    const owned = nations.filter((n) => n.ownerUserId === user.id);
    if (user.clerkUserId === realm.ownerId || owned.some((n) => n.realmId === realm.id)) continue;
    primaryRealmId.set(user.id, primaryNationOf(owned, user.countryId)?.realmId ?? null);
  }
  const labels = new Map<string, { slug: string; name: string } | null>();
  for (const id of new Set(primaryRealmId.values())) {
    const own = id ? await loadForumRealm(db, { id }) : null;
    labels.set(id ?? "", own && canSeeRealm(null, own) ? { slug: own.slug, name: own.name } : null);
  }
  for (const [userId, realmId] of primaryRealmId)
    visitors.set(userId, labels.get(realmId ?? "") ?? null);
  return visitors;
}

interface Lookups {
  maps: AuthorMaps;
  replies: Map<string, { authorName: string; excerpt: string }>;
  continued: Map<string, { threadId: string; title: string; replies: number }>;
}

/** The messages the rows answer and the threads they were continued in, as the viewer may see them. */
async function lookups(
  db: BoardMessageDb,
  place: BoardPlace,
  rows: readonly BoardRow[]
): Promise<Lookups> {
  const replyIds = [...new Set(rows.flatMap((r) => (r.replyToPostId ? [r.replyToPostId] : [])))];
  const threadIds = [
    ...new Set(rows.flatMap((r) => (r.continuedThreadId ? [r.continuedThreadId] : []))),
  ];
  const [answered, threads] = await Promise.all([
    replyIds.length
      ? db.forumPost.findMany({
          where: { id: { in: replyIds }, threadId: place.threadId },
          select: {
            id: true,
            plainText: true,
            hidden: true,
            authorUserId: true,
            authorPersonaId: true,
            importedAuthorName: true,
          },
        })
      : [],
    threadIds.length
      ? db.forumThread.findMany({
          where: { id: { in: threadIds } },
          select: { id: true, title: true, postCount: true, hidden: true },
        })
      : [],
  ]);
  const everyone = [...rows, ...answered];
  const maps = await authorsOf(
    db,
    everyone.map((r) => (r.authorPersonaId ? null : r.authorUserId)),
    everyone.map((r) => r.authorPersonaId)
  );
  const replies = new Map(
    answered
      .filter((p) => !p.hidden || place.canModerate)
      .map(
        (p) =>
          [
            p.id,
            { authorName: authorOf(p, maps).name, excerpt: boardExcerpt(p.plainText) },
          ] as const
      )
  );
  const continued = new Map(
    threads
      .filter((t) => !t.hidden || place.canModerate)
      .map(
        (t) =>
          [t.id, { threadId: t.id, title: t.title, replies: Math.max(0, t.postCount - 1) }] as const
      )
  );
  return { maps, replies, continued };
}

function messageOf(
  row: BoardRow,
  viewer: ForumViewer,
  place: BoardPlace,
  look: Lookups,
  extras: { role: PostRole | null; visitor: { slug: string; name: string } | null | undefined },
  now: number
): BoardMessage {
  const byViewer = viewer !== null && row.authorUserId === viewer.id;
  const persona = row.authorPersonaId !== null;
  const answered = row.replyToPostId ? look.replies.get(row.replyToPostId) : undefined;
  return {
    id: row.id,
    authorUserId: persona && !place.canModerate ? null : row.authorUserId,
    authorPersonaId: row.authorPersonaId,
    importedAuthorName: row.importedAuthorName,
    author: authorOf(row, look.maps),
    role: extras.role,
    isVisitor: extras.visitor !== undefined,
    visitorRealm: extras.visitor ?? null,
    contentHtml: row.contentHtml,
    createdAt: row.createdAt,
    editedAt: row.editedAt,
    ...(place.canModerate ? { hidden: row.hidden } : {}),
    byViewer,
    canEdit:
      byViewer &&
      !row.hidden &&
      row.continuedThreadId === null &&
      now - row.createdAt.getTime() <= BOARD_EDIT_WINDOW_MS,
    replyTo: row.replyToPostId && answered ? { postId: row.replyToPostId, ...answered } : null,
    continued: row.continuedThreadId ? (look.continued.get(row.continuedThreadId) ?? null) : null,
  };
}

/** Rows (any order) as board messages for `viewer`, in the same order. */
export async function shapeBoardMessages(
  db: BoardMessageDb,
  viewer: ForumViewer,
  place: BoardPlace,
  rows: readonly BoardRow[]
): Promise<BoardMessage[]> {
  if (rows.length === 0) return [];
  const [look, roles] = await Promise.all([
    lookups(db, place, rows),
    roleContextOf(db, { authorUserId: null, authorPersonaId: null }, place.category, rows),
  ]);
  const staffed = new Set([...roles.staffUserIds, ...roles.officerUserIds]);
  const visitors = await visitorRealms(
    db,
    place.realm,
    playerIds(rows).filter((id) => !staffed.has(id))
  );
  const now = Date.now();
  return rows.map((row) =>
    messageOf(
      row,
      viewer,
      place,
      look,
      {
        role: roleOf(row, roles),
        visitor:
          row.authorPersonaId === null && row.authorUserId
            ? visitors.get(row.authorUserId)
            : undefined,
      },
      now
    )
  );
}
