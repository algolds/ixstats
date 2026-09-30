/**
 * page-management-service.ts — WikiOS Native Page Operations, Renames, Soft Deletes & Media Usage
 *
 * Provides atomic, transactional page moves with redirect preservation,
 * soft deletion/restoration, reverse asset lookups, and maintenance diagnostics.
 */

import { db } from "~/server/db";
import { toArticleSlug } from "./domain-types";
import { canonicalizeTitle } from "./title";

export interface MovePageResult {
  success: boolean;
  oldSlug: string;
  newSlug: string;
  redirectArticleId: string;
  movedArticleId: string;
  linksUpdated: number;
}

export interface MediaUsageItem {
  articleId: string;
  articleSlug: string;
  articleTitle: string;
  status: string;
  snippet?: string;
}

export class PageManagementService {
  /**
   * Atomic Page Move / Rename with Redirect Creation & Link Graph Updates
   */
  static async movePage(
    oldSlugOrTitle: string,
    newTitle: string,
    reason: string,
    userId: string,
    realm = "ixwiki"
  ): Promise<MovePageResult> {
    const target = canonicalizeTitle(newTitle, { source: realm });
    if (!target) throw new Error("Invalid title");
    const { title: newCanonicalTitle, slug: newSlug } = target;
    const oldSlug = toArticleSlug(oldSlugOrTitle);

    if (oldSlug === newSlug) {
      throw new Error("Old and new page names are identical.");
    }

    return db.$transaction(async (tx) => {
      // 1. Fetch original article
      const original = await tx.wikiArticle.findFirst({
        where: {
          source: realm,
          OR: [{ slug: oldSlug }, { title: oldSlugOrTitle.replace(/_/g, " ") }],
        },
        select: { id: true, title: true, namespace: true },
      });

      if (!original) {
        throw new Error(`Article "${oldSlugOrTitle}" not found in realm "${realm}".`);
      }

      // 2. Check if target title already exists
      const existingTarget = await tx.wikiArticle.findFirst({
        where: {
          source: realm,
          OR: [{ slug: newSlug }, { title: newCanonicalTitle }],
        },
        select: { id: true },
      });

      if (existingTarget && existingTarget.id !== original.id) {
        throw new Error(`Destination title "${newCanonicalTitle}" already exists.`);
      }

      // 3. Update original article to new title and slug
      const movedArticle = await tx.wikiArticle.update({
        where: { id: original.id },
        data: {
          title: newCanonicalTitle,
          slug: newSlug,
          namespace: target.namespaceId,
          namespacePrefix: target.namespacePrefix,
          lastEditorId: userId,
          updatedAt: new Date(),
        },
        select: { id: true },
      });

      // 4. Create redirect article at the old location
      const redirectArticle = await tx.wikiArticle.create({
        data: {
          title: original.title,
          slug: oldSlug,
          source: realm,
          namespace: original.namespace,
          status: "PUBLISHED",
          format: "WIKITEXT",
          wikitext: `#REDIRECT [[${newCanonicalTitle}]]`,
          contentHtml: `<div class="redirect-banner">Redirect to <a href="/wiki/${newSlug}">${newCanonicalTitle}</a></div>`,
          redirectTargetSlug: newCanonicalTitle,
          // The move reason belongs on the log entry below, never in the article's excerpt.
          summary: null,
          authorId: userId,
          lastEditorId: userId,
        },
        select: { id: true },
      });

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
          actorName: userId || "Wiki Contributor",
          comment: reason,
          params: {
            oldTitle: original.title,
            oldSlug,
            newTitle: newCanonicalTitle,
            newSlug,
            reason,
          },
          userId,
          articleId: movedArticle.id,
        },
      });

      return {
        success: true,
        oldSlug,
        newSlug,
        redirectArticleId: redirectArticle.id,
        movedArticleId: movedArticle.id,
        linksUpdated: linkUpdateResult.count,
      };
    });
  }

  /**
   * Soft Delete / Archive an Article
   */
  static async archiveArticle(
    slugOrTitle: string,
    reason: string,
    userId: string,
    realm = "ixwiki"
  ): Promise<{ success: boolean; articleId: string }> {
    const slug = toArticleSlug(slugOrTitle);

    const article = await db.wikiArticle.findFirst({
      where: {
        source: realm,
        OR: [{ slug }, { title: slugOrTitle.replace(/_/g, " ") }],
      },
      select: { id: true, title: true, status: true },
    });

    if (!article) {
      throw new Error(`Article "${slugOrTitle}" not found.`);
    }

    await db.wikiArticle.update({
      where: { id: article.id },
      data: {
        status: "ARCHIVED",
        lastEditorId: userId,
        updatedAt: new Date(),
      },
      select: { id: true },
    });

    await db.wikiLog.create({
      data: {
        logType: "delete",
        action: "delete",
        title: article.title,
        actorName: userId || "Wiki Contributor",
        comment: reason,
        params: { reason, previousStatus: article.status },
        userId,
        articleId: article.id,
      },
    });

    return { success: true, articleId: article.id };
  }

  /**
   * Restore an Archived Article
   */
  static async restoreArticle(
    slugOrTitle: string,
    userId: string,
    realm = "ixwiki"
  ): Promise<{ success: boolean; articleId: string }> {
    const slug = toArticleSlug(slugOrTitle);

    const article = await db.wikiArticle.findFirst({
      where: {
        source: realm,
        OR: [{ slug }, { title: slugOrTitle.replace(/_/g, " ") }],
      },
      select: { id: true, title: true },
    });

    if (!article) {
      throw new Error(`Archived article "${slugOrTitle}" not found.`);
    }

    await db.wikiArticle.update({
      where: { id: article.id },
      data: {
        status: "PUBLISHED",
        lastEditorId: userId,
        updatedAt: new Date(),
      },
      select: { id: true },
    });

    await db.wikiLog.create({
      data: {
        logType: "delete",
        action: "restore",
        title: article.title,
        actorName: userId || "Wiki Contributor",
        comment: "Restored from archive",
        params: { restoredFrom: "ARCHIVED" },
        userId,
        articleId: article.id,
      },
    });

    return { success: true, articleId: article.id };
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
   * Maintenance Diagnostic: Broken Redirects. `redirectTargetSlug` holds the target's canonical
   * TITLE (the column name is historical), so a redirect is broken when no published article of
   * the same realm has that title. `targetSlug` in the result is that title.
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

      // A stored target is canonical when the app wrote it; canonicalizing again also covers
      // values the SQL backfill derived without a canonical namespace prefix.
      const withTargets = redirects.flatMap((r) =>
        r.redirectTargetSlug
          ? [
              {
                ...r,
                target:
                  canonicalizeTitle(r.redirectTargetSlug, { source: realm })?.title ??
                  r.redirectTargetSlug,
              },
            ]
          : []
      );

      const existingTargets = await db.wikiArticle.findMany({
        where: {
          source: realm,
          title: { in: withTargets.map((r) => r.target) },
          status: "PUBLISHED",
        },
        select: { title: true },
      });

      const validTargetSet = new Set(existingTargets.map((t) => t.title));

      return withTargets
        .filter((r) => !validTargetSet.has(r.target))
        .slice(0, limit)
        .map((r) => ({
          id: r.id,
          title: r.title,
          slug: r.slug,
          targetSlug: r.target,
        }));
    } catch {
      return [];
    }
  }
}
