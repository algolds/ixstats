/**
 * page-management-service.ts — WikiOS Native Page Operations, Renames, Soft Deletes & Media Usage
 *
 * Provides atomic, transactional page moves with redirect preservation,
 * soft deletion/restoration, reverse asset lookups, and maintenance diagnostics.
 */

import type { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { toArticleSlug } from "./domain-types";
import { canonicalizeTitle, NAMESPACE_CANONICAL_NAMES, type CanonicalTitle } from "./title";

/** Who performed an operation: the WikiOS user row (for the foreign keys) and the name the log shows. */
export interface PageActor {
  userId: string;
  name: string;
}

export type PageOperationErrorCode = "NOT_FOUND" | "CONFLICT" | "BAD_REQUEST";

/** A refusal the caller can act on (no such page, the destination exists); routers map it to a TRPCError. */
export class PageOperationError extends Error {
  constructor(
    readonly code: PageOperationErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PageOperationError";
  }
}

export interface MoveOneResult {
  oldSlug: string;
  newSlug: string;
  redirectArticleId: string | null;
  movedArticleId: string;
  linksUpdated: number;
}

export interface MovePageResult extends MoveOneResult {
  success: boolean;
  /** The talk page that moved with the page, or null when none did. */
  talk: MoveOneResult | null;
}

export interface MovePageOptions {
  /** Leave `#REDIRECT [[new]]` at the old title (default true). */
  leaveRedirect?: boolean;
  /** Move the talk page along when it exists and the destination talk page does not (default true). */
  moveTalk?: boolean;
}

export interface MediaUsageItem {
  articleId: string;
  articleSlug: string;
  articleTitle: string;
  status: string;
  snippet?: string;
}

/** The canonical title of the talk page of `title`, or null when it has none (a talk page, Special:, another wiki's page). */
export function talkTitleOf(title: string, realm = "ixwiki"): string | null {
  const canon = canonicalizeTitle(title, { source: realm });
  if (!canon || realm !== "ixwiki" || canon.namespaceId < 0 || canon.namespaceId % 2 === 1) {
    return null;
  }
  const prefix = NAMESPACE_CANONICAL_NAMES[canon.namespaceId + 1];
  return prefix ? `${prefix}:${canon.base}` : null;
}

/** The page `ref` (a slug or a title) names in `realm`, inside `client`. */
function findPage(client: Prisma.TransactionClient, ref: string, realm: string) {
  return client.wikiArticle.findFirst({
    where: { source: realm, OR: [{ slug: toArticleSlug(ref) }, { title: ref.replace(/_/g, " ") }] },
  });
}

function redirectWikitext(target: CanonicalTitle): string {
  return `#REDIRECT [[${target.title}]]`;
}

export class PageManagementService {
  /**
   * Atomic Page Move / Rename with Redirect Creation & Link Graph Updates. The page keeps its row,
   * so its revisions, categories and watchers stay attached; the old title gets a redirect page
   * (with its own `#REDIRECT` revision) when `leaveRedirect`; the talk page moves too when `moveTalk`.
   */
  static async movePage(
    oldSlugOrTitle: string,
    newTitle: string,
    reason: string,
    actor: PageActor,
    realm = "ixwiki",
    { leaveRedirect = true, moveTalk = true }: MovePageOptions = {}
  ): Promise<MovePageResult> {
    const target = canonicalizeTitle(newTitle, { source: realm });
    if (!target) throw new PageOperationError("BAD_REQUEST", "Invalid title");
    if (toArticleSlug(oldSlugOrTitle) === target.slug) {
      throw new PageOperationError("BAD_REQUEST", "Old and new page names are identical.");
    }

    return db.$transaction(async (tx) => {
      const move = { reason, actor, realm, leaveRedirect };
      const moved = await this.moveOne(tx, oldSlugOrTitle, target, move);
      const fromTalk = moveTalk ? talkTitleOf(oldSlugOrTitle, realm) : null;
      const toTalk = moveTalk ? talkTitleOf(target.title, realm) : null;
      const talkTarget = toTalk ? canonicalizeTitle(toTalk, { source: realm }) : null;
      const talk =
        fromTalk && talkTarget && (await this.canMoveTalk(tx, fromTalk, talkTarget, realm))
          ? await this.moveOne(tx, fromTalk, talkTarget, move)
          : null;
      return { success: true, ...moved, talk };
    });
  }

  /** Whether the talk page `fromTalk` exists and the destination talk page is free. */
  private static async canMoveTalk(
    tx: Prisma.TransactionClient,
    fromTalk: string,
    talkTarget: CanonicalTitle,
    realm: string
  ): Promise<boolean> {
    const [source, destination] = await Promise.all([
      findPage(tx, fromTalk, realm),
      findPage(tx, talkTarget.title, realm),
    ]);
    return source !== null && destination === null;
  }

  private static async moveOne(
    tx: Prisma.TransactionClient,
    oldSlugOrTitle: string,
    target: CanonicalTitle,
    {
      reason,
      actor,
      realm,
      leaveRedirect,
    }: {
      reason: string;
      actor: PageActor;
      realm: string;
      leaveRedirect: boolean;
    }
  ): Promise<MoveOneResult> {
    const { title: newCanonicalTitle, slug: newSlug } = target;
    const oldSlug = toArticleSlug(oldSlugOrTitle);

    // 1. Fetch original article
    const original = await findPage(tx, oldSlugOrTitle, realm);
    if (!original) {
      throw new PageOperationError(
        "NOT_FOUND",
        `Article "${oldSlugOrTitle}" not found in realm "${realm}".`
      );
    }

    // 2. Check if target title already exists
    const existingTarget = await tx.wikiArticle.findFirst({
      where: { source: realm, OR: [{ slug: newSlug }, { title: newCanonicalTitle }] },
    });
    if (existingTarget && existingTarget.id !== original.id) {
      throw new PageOperationError(
        "CONFLICT",
        `Destination title "${newCanonicalTitle}" already exists.`
      );
    }

    // 3. Update original article to new title and slug
    const movedArticle = await tx.wikiArticle.update({
      where: { id: original.id },
      data: {
        title: newCanonicalTitle,
        slug: newSlug,
        namespace: target.namespaceId,
        namespacePrefix: target.namespacePrefix,
        lastEditorId: actor.userId,
        updatedAt: new Date(),
      },
    });

    // 4. Create a redirect at the old location: a page with its own `#REDIRECT` revision
    const redirectArticleId = leaveRedirect
      ? await this.createRedirect(tx, original, oldSlug, target, actor, realm)
      : null;

    // 5. Update Link Graph: Repoint incoming links to new article ID
    const linkUpdateResult = await tx.wikiLink.updateMany({
      where: { targetArticleId: original.id },
      data: { targetArticleId: movedArticle.id },
    });

    // 6. Log the move action
    await tx.wikiLog.create({
      data: {
        logType: "move",
        action: "move",
        title: newCanonicalTitle,
        actorName: actor.name,
        comment: reason,
        params: {
          oldTitle: original.title,
          oldSlug,
          newTitle: newCanonicalTitle,
          newSlug,
          reason,
          redirectCreated: leaveRedirect,
        },
        userId: actor.userId,
        articleId: movedArticle.id,
      },
    });

    return {
      oldSlug,
      newSlug,
      redirectArticleId,
      movedArticleId: movedArticle.id,
      linksUpdated: linkUpdateResult.count,
    };
  }

  private static async createRedirect(
    tx: Prisma.TransactionClient,
    original: { title: string; namespace: number },
    oldSlug: string,
    target: CanonicalTitle,
    actor: PageActor,
    realm: string
  ): Promise<string> {
    const wikitext = redirectWikitext(target);
    const summary = `Redirected to [[${target.title}]] via page move`;
    const redirectArticle = await tx.wikiArticle.create({
      data: {
        title: original.title,
        slug: oldSlug,
        source: realm,
        namespace: original.namespace,
        status: "PUBLISHED",
        format: "WIKITEXT",
        wikitext,
        contentHtml: `<div class="redirect-banner">Redirect to <a href="/wiki/${target.slug}">${target.title}</a></div>`,
        redirectTargetSlug: target.slug,
        summary,
        authorId: actor.userId,
        lastEditorId: actor.userId,
      },
    });
    const byteSize = Buffer.byteLength(wikitext, "utf8");
    await tx.wikiRevision.create({
      data: {
        articleId: redirectArticle.id,
        wikitext,
        summary,
        source: realm,
        author: actor.name,
        authorId: actor.userId,
        byteSize,
        byteDelta: byteSize,
      },
    });
    return redirectArticle.id;
  }

  /**
   * Soft Delete / Archive an Article (MediaWiki "delete"; revisions stay, readers get NOT_FOUND).
   */
  static async archiveArticle(
    slugOrTitle: string,
    reason: string,
    actor: PageActor,
    realm = "ixwiki"
  ): Promise<{ success: boolean; articleId: string }> {
    return db.$transaction(async (tx) => {
      const article = await findPage(tx, slugOrTitle, realm);
      if (!article) {
        throw new PageOperationError("NOT_FOUND", `Article "${slugOrTitle}" not found.`);
      }
      if (article.status === "ARCHIVED") {
        throw new PageOperationError("CONFLICT", `"${article.title}" is already deleted.`);
      }

      await tx.wikiArticle.update({
        where: { id: article.id },
        data: { status: "ARCHIVED", lastEditorId: actor.userId, updatedAt: new Date() },
      });
      await tx.wikiLog.create({
        data: {
          logType: "delete",
          action: "delete",
          title: article.title,
          actorName: actor.name,
          comment: reason,
          params: { reason, previousStatus: article.status },
          userId: actor.userId,
          articleId: article.id,
        },
      });
      return { success: true, articleId: article.id };
    });
  }

  /**
   * Restore an Archived Article (MediaWiki "undelete").
   */
  static async restoreArticle(
    slugOrTitle: string,
    actor: PageActor,
    realm = "ixwiki",
    reason = "Restored from archive"
  ): Promise<{ success: boolean; articleId: string }> {
    return db.$transaction(async (tx) => {
      const article = await findPage(tx, slugOrTitle, realm);
      if (!article) {
        throw new PageOperationError("NOT_FOUND", `Archived article "${slugOrTitle}" not found.`);
      }
      if (article.status !== "ARCHIVED") {
        throw new PageOperationError("CONFLICT", `"${article.title}" is not deleted.`);
      }

      await tx.wikiArticle.update({
        where: { id: article.id },
        data: { status: "PUBLISHED", lastEditorId: actor.userId, updatedAt: new Date() },
      });
      await tx.wikiLog.create({
        data: {
          logType: "delete",
          action: "restore",
          title: article.title,
          actorName: actor.name,
          comment: reason,
          params: { reason, restoredFrom: "ARCHIVED" },
          userId: actor.userId,
          articleId: article.id,
        },
      });
      return { success: true, articleId: article.id };
    });
  }

  /**
   * Reverse Media Asset Usage Lookups
   */
  static async getMediaUsage(assetFilenameOrSlug: string, limit = 50): Promise<MediaUsageItem[]> {
    const clean = assetFilenameOrSlug.replace(/^File:/i, "").trim();

    const articles = await db.wikiArticle.findMany({
      where: {
        OR: [
          { wikitext: { contains: clean, mode: "insensitive" } },
          { contentHtml: { contains: clean, mode: "insensitive" } },
          { leadImageUrl: { contains: clean, mode: "insensitive" } },
        ],
      },
      take: limit,
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        wikitext: true,
      },
    });

    return articles.map((a) => ({
      articleId: a.id,
      articleSlug: a.slug,
      articleTitle: a.title,
      status: a.status,
      snippet: a.wikitext?.substring(0, 160),
    }));
  }

  /**
   * Maintenance Diagnostic: Orphan Pages (0 Incoming Links)
   */
  static async getOrphanPages(
    limit = 50,
    realm = "ixwiki"
  ): Promise<Array<{ id: string; title: string; slug: string; length: number }>> {
    try {
      const orphans = await db.wikiArticle.findMany({
        where: {
          source: realm,
          namespace: 0,
          status: "PUBLISHED",
          redirectTargetSlug: null,
          incomingLinks: {
            none: {},
          },
        },
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          wikitext: true,
        },
      });

      return (orphans || []).map((o) => ({
        id: o.id,
        title: o.title,
        slug: o.slug,
        length: o.wikitext ? o.wikitext.length : 0,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Maintenance Diagnostic: Dead-End Pages (0 Outgoing Links)
   */
  static async getDeadEndPages(
    limit = 50,
    realm = "ixwiki"
  ): Promise<Array<{ id: string; title: string; slug: string; length: number }>> {
    try {
      const deadEnds = await db.wikiArticle.findMany({
        where: {
          source: realm,
          namespace: 0,
          status: "PUBLISHED",
          redirectTargetSlug: null,
          outgoingLinks: {
            none: {},
          },
        },
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          wikitext: true,
        },
      });

      return (deadEnds || []).map((d) => ({
        id: d.id,
        title: d.title,
        slug: d.slug,
        length: d.wikitext ? d.wikitext.length : 0,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Maintenance Diagnostic: Broken Redirects
   */
  static async getBrokenRedirects(
    limit = 50,
    realm = "ixwiki"
  ): Promise<Array<{ id: string; title: string; slug: string; targetSlug: string }>> {
    try {
      const redirects = await db.wikiArticle.findMany({
        where: {
          source: realm,
          redirectTargetSlug: { not: null },
        },
        take: limit * 2,
        select: {
          id: true,
          title: true,
          slug: true,
          redirectTargetSlug: true,
        },
      });

      if (!redirects || redirects.length === 0) return [];

      const targetSlugs = redirects
        .map((r) => r.redirectTargetSlug)
        .filter((s): s is string => Boolean(s));

      const existingTargets = await db.wikiArticle.findMany({
        where: {
          source: realm,
          slug: { in: targetSlugs },
          status: "PUBLISHED",
        },
        select: { slug: true },
      });

      const validTargetSet = new Set(existingTargets.map((t) => t.slug));

      return redirects
        .filter((r) => r.redirectTargetSlug && !validTargetSet.has(r.redirectTargetSlug))
        .slice(0, limit)
        .map((r) => ({
          id: r.id,
          title: r.title,
          slug: r.slug,
          targetSlug: r.redirectTargetSlug!,
        }));
    } catch {
      return [];
    }
  }
}
