/**
 * pg-activity.ts — ixwiki recent changes, page history, user contributions and user info.
 *
 * Split out of pg-reader.ts (which re-exports it); ixwiki reads from PostgreSQL alone, MediaWiki is
 * never asked (plan 418).
 */

import { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { toArticleSlug } from "~/lib/wiki-os/core/domain-types";
import { loadWikiUserInfo, type WikiUserInfo } from "~/lib/wiki-os/core/wiki-user-info";
import { normalizeWikiUsername } from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import { resolveStoredImageUrl } from "~/lib/wiki-os/transformers/image-url";
import { cleanExcerpt, calculateRawTextBytes } from "~/lib/wiki-os/transformers/wikitext-parser";
import type { WikiRecentChange } from "./types";

// ---------------------------------------------------------------------------
// Activity, Contributions & History
// ---------------------------------------------------------------------------

export async function ixwikiRecentChanges(limit: number = 20): Promise<WikiRecentChange[]> {
  try {
    const revs = await db.wikiRevision.findMany({
      where: {
        source: "ixwiki",
        article: { namespace: 0, status: "PUBLISHED" },
        author: { notIn: ["LorewardsBot", "Maintenance script", "Robot"] },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        article: {
          select: {
            title: true,
            summary: true,
            leadImageUrl: true,
            wikitext: true,
          },
        },
      },
    });

    return revs
      .filter((r) => r.article?.title)
      .map((r) => {
        const blurb = cleanExcerpt(r.wikitext || r.article.wikitext || r.article.summary, 180);
        const rawSize = calculateRawTextBytes(r.wikitext || r.article.wikitext);
        const delta = r.byteDelta !== 0 ? r.byteDelta : rawSize;

        return {
          title: r.article.title,
          user: r.author || "MediaWiki Editor",
          timestamp: new Date(r.createdAt).toISOString(),
          comment: r.summary || "",
          type: "edit" as const,
          oldLen: Math.max(0, rawSize - delta),
          newLen: rawSize,
          blurb: blurb || null,
          thumbnail: resolveStoredImageUrl(r.article.leadImageUrl),
          parked: r.parked,
        };
      });
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.warn("[WikiOS:pg-reader]", err);
  }

  return [];
}

export async function ixwikiGetHistory(
  title: string,
  limit: number = 50,
  _offset?: number
): Promise<
  Array<{
    rev_id: number;
    rev_timestamp: string;
    rev_user_text: string;
    rev_comment: string;
    rev_len: number;
    rev_minor_edit: number;
    diff: number;
    /** A MediaWiki edit that did not go live (conflict): in the history, never the page's text. */
    parked: boolean;
  }>
> {
  try {
    const revs = await db.wikiRevision.findMany({
      where: {
        article: {
          source: "ixwiki",
          OR: [{ title }, { slug: toArticleSlug(title) }],
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        mwRevId: true,
        author: true,
        summary: true,
        byteSize: true,
        byteDelta: true,
        minor: true,
        parked: true,
        createdAt: true,
      },
    });

    return revs.map((r) => ({
      rev_id: r.mwRevId || 0,
      rev_timestamp: new Date(r.createdAt).toISOString(),
      rev_user_text: r.author || "MediaWiki Editor",
      rev_comment: r.summary || "",
      rev_len: r.byteSize || 0,
      rev_minor_edit: r.minor ? 1 : 0,
      diff: r.byteDelta || 0,
      parked: r.parked,
    }));
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.warn("[WikiOS:pg-reader]", err);
  }

  return [];
}

export interface UserContribution {
  rev_id: number;
  page_title: string;
  page_namespace: number;
  rev_timestamp: string;
  rev_len: number;
  diff: number;
  rev_comment: string;
  rev_minor_edit: number;
  is_new: boolean;
  /** A MediaWiki edit that did not go live (conflict): the user's, listed, never the page's text. */
  parked: boolean;
}

/**
 * The WikiOS users who proved they own the wiki account `username`: their revisions carry the user
 * id, whatever name the edit was saved under. At most one (a wiki account links to one user).
 */
async function linkedUserIds(username: string): Promise<string[]> {
  const links = await db.wikiAccountLink.findMany({
    where: {
      source: "ixwiki",
      username: normalizeWikiUsername(username),
      verifiedAt: { not: null },
    },
    select: { userId: true },
    take: 1, // a wiki account links to one user
  });
  return links.map((link) => link.userId);
}

/** The revisions made by the account `username`: by the name it edited under, or by its verified owner's id. */
function madeBy(username: string, userIds: readonly string[]): Prisma.WikiRevisionWhereInput {
  const named = {
    author: { equals: normalizeWikiUsername(username), mode: "insensitive" as const },
  };
  return userIds.length > 0 ? { OR: [named, { authorId: { in: [...userIds] } }] } : named;
}

export async function ixwikiGetUserContribs(
  username: string,
  limit: number = 50,
  _offset?: number,
  namespace: number = 0
): Promise<UserContribution[]> {
  try {
    const revs = await db.wikiRevision.findMany({
      where: {
        ...madeBy(username, await linkedUserIds(username)),
        article: { namespace, status: "PUBLISHED" },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        article: {
          select: { title: true, namespace: true },
        },
      },
    });

    // MediaWiki lists every edit its editor made, parked ones too: each says whether it ever went live.
    return revs.map((r) => ({
      rev_id: Number(r.mwRevId || 0),
      page_title: r.article?.title || "Untitled",
      page_namespace: Number(r.article?.namespace || 0),
      rev_timestamp: new Date(r.createdAt).toISOString(),
      rev_len: Number(r.byteSize || 0),
      diff: Number(r.byteDelta || 0),
      rev_comment: String(r.summary || ""),
      rev_minor_edit: r.minor ? 1 : 0,
      is_new: Number(r.byteSize || 0) === Number(r.byteDelta || 0),
      parked: r.parked,
    }));
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.warn("[WikiOS:pg-reader]", err);
  }

  return [];
}

interface CreatedPageRow {
  title: string;
  namespace: number;
  createdAt: Date;
  byteSize: number;
}

/**
 * The main-namespace pages `username` created, newest first: the published pages whose oldest live
 * revision (a parked edit is nobody's creation) was made by that account, by name or by its verified
 * owner's id. `createdAt` and `byteSize` are those of that first revision.
 */
export async function ixwikiGetUserCreatedPages(
  username: string,
  limit: number = 100
): Promise<
  Array<{
    title: string;
    namespace: number;
    createdAt: string;
    byteSize: number;
  }>
> {
  try {
    const name = normalizeWikiUsername(username);
    const userIds = await linkedUserIds(username);
    const byOwner =
      userIds.length > 0 ? Prisma.sql`OR f."authorId" IN (${Prisma.join(userIds)})` : Prisma.empty;
    const rows = await db.$queryRaw<CreatedPageRow[]>`
      SELECT a."title" AS "title", a."namespace" AS "namespace",
             f."createdAt" AS "createdAt", f."byteSize" AS "byteSize"
      FROM wiki_articles a
      JOIN LATERAL (
        SELECT r."author", r."authorId", r."createdAt", r."byteSize"
        FROM wiki_revisions r
        WHERE r."articleId" = a."id" AND r."parked" = false
        ORDER BY r."createdAt" ASC, r."id" ASC
        LIMIT 1
      ) f ON true
      WHERE a."source" = 'ixwiki' AND a."status" = 'PUBLISHED' AND a."namespace" = 0
        AND (lower(f."author") = lower(${name}) ${byOwner})
      ORDER BY f."createdAt" DESC
      LIMIT ${limit}`;

    return rows.map((row) => ({
      title: row.title,
      namespace: row.namespace,
      createdAt: new Date(row.createdAt).toISOString(),
      byteSize: Number(row.byteSize || 0),
    }));
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.warn("[WikiOS:pg-reader]", err);
  }

  return [];
}

export type IxwikiUserInfo = WikiUserInfo;

/**
 * What WikiOS knows about a wiki account (see `loadWikiUserInfo`): its edit count, registration,
 * groups and whether it exists, all from Postgres. A name with no trace reports `exists: false`.
 */
export async function ixwikiGetUserInfo(username: string): Promise<IxwikiUserInfo | null> {
  return loadWikiUserInfo(username);
}
