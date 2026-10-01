// src/lib/wiki-os/services/margin-service.ts
// Margin (discussion threads on an article): what a reader may see of each author, who may change a
// thread or comment, and the paged reads. The read endpoint is public, so an author is only ever a
// display name, an avatar and an `isAuthor` flag: never an internal user id, a Discord handle, a role
// or a country (plan 416).

import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod/v4";
import { db } from "~/server/db";
import { isWikiAdmin, requireWikiUserIds, type WikiAuthContext } from "~/lib/wiki-os/auth";

/** Threads per page of `loadMarginPage`. */
export const MARGIN_THREAD_PAGE = 50;
/** Comments per page, inside a thread and in `loadThreadComments`. */
export const MARGIN_COMMENT_PAGE = 100;

export type MarginStatus = "ALL" | "OPEN" | "RESOLVED" | "ARCHIVED";

/** What a reader learns about whoever wrote a thread or comment. */
export interface MarginAuthor {
  username: string;
  avatar: string | null;
  /** The reader wrote it. */
  isAuthor: boolean;
}

interface AuthorRecord {
  wikiUsername: string | null;
  country: { name: string } | null;
}

/** Thread and comment rows name their author by internal id, Clerk id, wiki username or Discord id. */
type AuthorIndex = ReadonlyMap<string, AuthorRecord>;

const reactionCounts = z.record(z.string(), z.number()).catch({});

export const normalizeMarginTitle = (title: string): string => title.trim().replace(/ /g, "_");

/** The ids the reader's own rows may be keyed by; empty for an anonymous reader. */
function viewerIds(ctx: WikiAuthContext): ReadonlySet<string> {
  return ctx.user?.id || ctx.auth?.userId ? new Set(requireWikiUserIds(ctx)) : new Set();
}

/** A public name: the wiki username, else the IxStates country name, never a Discord handle or an id. */
function displayName(record: AuthorRecord | undefined): string {
  return record?.wikiUsername?.trim() || record?.country?.name?.trim() || "Unknown user";
}

async function loadAuthors(rawIds: Iterable<string>): Promise<AuthorIndex> {
  const ids = [...new Set(rawIds)].filter(Boolean);
  const index = new Map<string, AuthorRecord>();
  if (ids.length === 0) return index;
  const users = await db.user.findMany({
    where: {
      OR: [
        { id: { in: ids } },
        { clerkUserId: { in: ids } },
        { wikiUsername: { in: ids } },
        { discordUserId: { in: ids } },
      ],
    },
    select: {
      id: true,
      clerkUserId: true,
      wikiUsername: true,
      discordUserId: true,
      country: { select: { name: true } },
    },
  });
  for (const user of users) {
    for (const key of [user.id, user.clerkUserId, user.wikiUsername, user.discordUserId]) {
      if (key) index.set(key, user);
    }
  }
  return index;
}

function toAuthor(rawId: string, authors: AuthorIndex, viewer: ReadonlySet<string>): MarginAuthor {
  return {
    username: displayName(authors.get(rawId)),
    avatar: null,
    // The same test the write endpoints use: the row is keyed by one of the reader's own ids.
    isAuthor: viewer.has(rawId),
  };
}

const commentOrder = [{ createdAt: "asc" as const }, { id: "asc" as const }];

interface CommentRow {
  id: string;
  threadId: string;
  userId: string;
  content: string;
  suggestedEdit: string | null;
  reactions: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}

function toComment(row: CommentRow, authors: AuthorIndex, viewer: ReadonlySet<string>) {
  return {
    id: row.id,
    threadId: row.threadId,
    content: row.content,
    suggestedEdit: row.suggestedEdit,
    reactions: reactionCounts.parse(row.reactions ?? {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    author: toAuthor(row.userId, authors, viewer),
  };
}

/** One page of an article's threads (newest activity first, open before resolved), each with its first comments. */
export async function loadMarginPage(
  ctx: WikiAuthContext,
  input: { articleTitle: string; status: MarginStatus; cursor?: string }
) {
  const articleTitle = normalizeMarginTitle(input.articleTitle);
  const viewer = viewerIds(ctx);
  const [rows, totalOpenCount, totalResolvedCount] = await Promise.all([
    db.wikiDiscussionThread.findMany({
      where: { articleTitle, ...(input.status !== "ALL" ? { status: input.status } : {}) },
      include: {
        comments: { orderBy: commentOrder, take: MARGIN_COMMENT_PAGE },
        _count: { select: { comments: true } },
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }, { id: "asc" }],
      take: MARGIN_THREAD_PAGE + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    }),
    db.wikiDiscussionThread.count({ where: { articleTitle, status: "OPEN" } }),
    db.wikiDiscussionThread.count({ where: { articleTitle, status: "RESOLVED" } }),
  ]);

  const threads = rows.slice(0, MARGIN_THREAD_PAGE);
  const authors = await loadAuthors(
    threads.flatMap((t) => [t.createdBy, t.resolvedBy ?? "", ...t.comments.map((c) => c.userId)])
  );

  return {
    threads: threads.map((t) => ({
      id: t.id,
      articleTitle: t.articleTitle,
      status: t.status,
      title: t.title,
      sectionAnchor: t.sectionAnchor,
      selectedText: t.selectedText,
      anchorOffset: t.anchorOffset,
      resolvedAt: t.resolvedAt,
      resolvedBy: t.resolvedBy ? { username: displayName(authors.get(t.resolvedBy)) } : null,
      createdBy: toAuthor(t.createdBy, authors, viewer),
      teamId: t.teamId,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      comments: t.comments.map((c) => toComment(c, authors, viewer)),
      commentCount: t._count.comments,
      hasMoreComments: t._count.comments > t.comments.length,
    })),
    nextCursor: rows.length > MARGIN_THREAD_PAGE ? (threads.at(-1)?.id ?? null) : null,
    totalOpenCount,
    totalResolvedCount,
    /** Whether this reader may resolve, reopen or delete any thread and delete any comment. */
    canModerate: viewer.size > 0 && (await isWikiAdmin(ctx)),
  };
}

/** The next page of a thread's comments, after `cursor` (the id of the last one the reader has). */
export async function loadThreadComments(
  ctx: WikiAuthContext,
  input: { threadId: string; cursor?: string }
) {
  const viewer = viewerIds(ctx);
  const rows = await db.wikiDiscussionComment.findMany({
    where: { threadId: input.threadId },
    orderBy: commentOrder,
    take: MARGIN_COMMENT_PAGE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, MARGIN_COMMENT_PAGE);
  const authors = await loadAuthors(page.map((c) => c.userId));
  return {
    comments: page.map((c) => toComment(c, authors, viewer)),
    nextCursor: rows.length > MARGIN_COMMENT_PAGE ? (page.at(-1)?.id ?? null) : null,
  };
}

/**
 * Throws FORBIDDEN unless the caller wrote the row (`ownerId` is one of their ids) or is a sysop
 * (holds `editprotected`). The creator check is by id only: a wiki username is not proof of identity.
 */
export async function requireOwnerOrSysop(
  ctx: WikiAuthContext,
  ownerId: string,
  action: string
): Promise<void> {
  if (requireWikiUserIds(ctx).includes(ownerId)) return;
  if (await isWikiAdmin(ctx)) return;
  throw new TRPCError({
    code: "FORBIDDEN",
    message: `permissiondenied: Only the author or a sysop may ${action}.`,
  });
}
