// The WikiOS maintenance reports (split out of page-management-service.ts): what uses a file, orphaned and
// dead-end pages, broken redirects. PageManagementService exposes them under the same names.

import { db } from "~/server/db";
import { canonicalizeTitle } from "./title";

export interface MediaUsageItem {
  articleId: string;
  articleSlug: string;
  articleTitle: string;
  status: string;
  snippet?: string;
}

export const PageReports = {
  /**
   * Reverse Media Asset Usage Lookups
   */
  async getMediaUsage(assetFilenameOrSlug: string, limit = 50): Promise<MediaUsageItem[]> {
    const clean = assetFilenameOrSlug.replace(/^File:/i, "").trim();

    const articles = await db.wikiArticle.findMany({
      where: {
        status: "PUBLISHED",
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
  },
  /**
   * Maintenance Diagnostic: Orphan Pages (0 Incoming Links)
   */
  async getOrphanPages(
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
  },
  /**
   * Maintenance Diagnostic: Dead-End Pages (0 Outgoing Links)
   */
  async getDeadEndPages(
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
  },
  /**
   * Maintenance Diagnostic: Broken Redirects. `redirectTargetSlug` holds the target's canonical
   * TITLE (the column name is historical), so a redirect is broken when no published article of
   * the same realm has that title. `targetSlug` in the result is that title.
   */
  async getBrokenRedirects(
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
  },
};
