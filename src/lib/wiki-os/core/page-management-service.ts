/**
 * page-management-service.ts — WikiOS Native Page Operations, Renames, Soft Deletes & Media Usage
 *
 * Provides atomic, transactional page moves with redirect preservation,
 * soft deletion/restoration, reverse asset lookups, and maintenance diagnostics.
 */

import { db } from "~/server/db";
import { toArticleSlug } from "./domain-types";

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
    const oldSlug = toArticleSlug(oldSlugOrTitle);
    const newSlug = toArticleSlug(newTitle);

    if (oldSlug === newSlug) {
      throw new Error("Old and new page names are identical.");
    }

    return db.$transaction(async (tx) => {
      // 1. Fetch original article
      const original: any = await (tx as any).wikiArticle.findFirst({
        where: {
          source: realm,
          OR: [{ slug: oldSlug }, { title: oldSlugOrTitle.replace(/_/g, " ") }],
        },
      });

      if (!original) {
        throw new Error(`Article "${oldSlugOrTitle}" not found in realm "${realm}".`);
      }

      // 2. Check if target title already exists
      const existingTarget: any = await (tx as any).wikiArticle.findFirst({
        where: {
          source: realm,
          OR: [{ slug: newSlug }, { title: newTitle.replace(/_/g, " ") }],
        },
      });

      if (existingTarget && existingTarget.id !== original.id) {
        throw new Error(`Destination title "${newTitle}" already exists.`);
      }

      // 3. Update original article to new title and slug
      const movedArticle: any = await (tx as any).wikiArticle.update({
        where: { id: original.id },
        data: {
          title: newTitle.replace(/_/g, " "),
          slug: newSlug,
          lastEditorId: userId,
          updatedAt: new Date(),
        },
      });

      // 4. Create redirect article at the old location
      const redirectArticle: any = await (tx as any).wikiArticle.create({
        data: {
          title: original.title,
          slug: oldSlug,
          source: realm,
          namespace: original.namespace,
          status: "PUBLISHED",
          format: "WIKITEXT",
          wikitext: `#REDIRECT [[${newTitle.replace(/_/g, " ")}]]`,
          contentHtml: `<div class="redirect-banner">Redirect to <a href="/wiki/${newSlug}">${newTitle}</a></div>`,
          redirectTargetSlug: newSlug,
          summary: `Redirected to [[${newTitle}]] via page move`,
          authorId: userId,
          lastEditorId: userId,
        },
      });

      // 5. Update Link Graph: Repoint incoming links to new article ID
      const linkUpdateResult = await (tx as any).wikiLink.updateMany({
        where: { targetArticleId: original.id },
        data: { targetArticleId: movedArticle.id },
      });

      // 6. Log the move action
      await (tx as any).wikiLog.create({
        data: {
          action: "move",
          title: newTitle,
          details: {
            oldTitle: original.title,
            oldSlug,
            newTitle,
            newSlug,
            reason,
          },
          userId,
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

    const article: any = await (db as any).wikiArticle.findFirst({
      where: {
        source: realm,
        OR: [{ slug }, { title: slugOrTitle.replace(/_/g, " ") }],
      },
    });

    if (!article) {
      throw new Error(`Article "${slugOrTitle}" not found.`);
    }

    await (db as any).wikiArticle.update({
      where: { id: article.id },
      data: {
        status: "ARCHIVED",
        lastEditorId: userId,
        updatedAt: new Date(),
      },
    });

    await (db as any).wikiLog.create({
      data: {
        action: "delete",
        title: article.title,
        details: { reason, previousStatus: article.status },
        userId,
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

    const article: any = await (db as any).wikiArticle.findFirst({
      where: {
        source: realm,
        OR: [{ slug }, { title: slugOrTitle.replace(/_/g, " ") }],
      },
    });

    if (!article) {
      throw new Error(`Archived article "${slugOrTitle}" not found.`);
    }

    await (db as any).wikiArticle.update({
      where: { id: article.id },
      data: {
        status: "PUBLISHED",
        lastEditorId: userId,
        updatedAt: new Date(),
      },
    });

    await (db as any).wikiLog.create({
      data: {
        action: "restore",
        title: article.title,
        details: { restoredFrom: "ARCHIVED" },
        userId,
      },
    });

    return { success: true, articleId: article.id };
  }

  /**
   * Reverse Media Asset Usage Lookups
   */
  static async getMediaUsage(assetFilenameOrSlug: string, limit = 50): Promise<MediaUsageItem[]> {
    const clean = assetFilenameOrSlug.replace(/^File:/i, "").trim();

    const articles = await (db as any).wikiArticle.findMany({
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

    return articles.map((a: any) => ({
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
  static async getOrphanPages(limit = 50, realm = "ixwiki"): Promise<Array<{ id: string; title: string; slug: string; length: number }>> {
    try {
      const orphans: any = await (db as any).wikiArticle.findMany({
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

      return (orphans || []).map((o: any) => ({
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
  static async getDeadEndPages(limit = 50, realm = "ixwiki"): Promise<Array<{ id: string; title: string; slug: string; length: number }>> {
    try {
      const deadEnds: any = await (db as any).wikiArticle.findMany({
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

      return (deadEnds || []).map((d: any) => ({
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
  static async getBrokenRedirects(limit = 50, realm = "ixwiki"): Promise<Array<{ id: string; title: string; slug: string; targetSlug: string }>> {
    try {
      const redirects: any = await (db as any).wikiArticle.findMany({
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
        .map((r: any) => r.redirectTargetSlug)
        .filter((s: any): s is string => Boolean(s));

      const existingTargets: any = await (db as any).wikiArticle.findMany({
        where: {
          source: realm,
          slug: { in: targetSlugs },
          status: "PUBLISHED",
        },
        select: { slug: true },
      });

      const validTargetSet = new Set(existingTargets.map((t: any) => t.slug));

      return redirects
        .filter((r: any) => !validTargetSet.has(r.redirectTargetSlug))
        .slice(0, limit)
        .map((r: any) => ({
          id: r.id,
          title: r.title,
          slug: r.slug,
          targetSlug: r.redirectTargetSlug,
        }));
    } catch {
      return [];
    }
  }
}
