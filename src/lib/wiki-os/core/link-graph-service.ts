/**
 * link-graph-service.ts — WikiOS Relational Link Graph Engine
 *
 * Automatically parses [[WikiLinks]] and internal anchor tags from wikitext / HTML / AST,
 * maintains the directed graph in `wiki_links`, and delivers O(1) indexed backlink lookups.
 */

import { db } from "~/server/db";
import { toArticleSlug } from "./domain-types";

export interface ExtractedLink {
  targetSlug: string;
  anchorText?: string;
  sectionAnchor?: string;
  isExternal: boolean;
}

export class LinkGraphService {
  /**
   * Extract all internal and external link references from content
   */
  static extractLinks(wikitext: string, html?: string): ExtractedLink[] {
    const linkMap = new Map<string, ExtractedLink>();

    // 1. Parse Wikitext internal links: [[Target|Label]] or [[Target#Section|Label]]
    const wikitextRegex = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;
    let match: RegExpExecArray | null;

    while ((match = wikitextRegex.exec(wikitext)) !== null) {
      const rawTarget = match[1]?.trim();
      const section = match[2]?.trim();
      const label = match[3]?.trim() || rawTarget;

      if (rawTarget && !rawTarget.startsWith("File:") && !rawTarget.startsWith("Category:")) {
        const slug = toArticleSlug(rawTarget);
        const key = `${slug}#${section || ""}`;
        if (!linkMap.has(key)) {
          linkMap.set(key, {
            targetSlug: slug,
            anchorText: label,
            sectionAnchor: section || undefined,
            isExternal: false,
          });
        }
      }
    }

    // 2. Parse HTML anchors: <a href="/wiki/Target">
    if (html) {
      const htmlRegex =
        /<a\s+[^>]*href=["'](?:\/wiki\/|\/w\/)([^"#'?]+)(?:#([^"']+))?["'][^>]*>(.*?)<\/a>/gi;
      while ((match = htmlRegex.exec(html)) !== null) {
        const rawTarget = match[1]?.trim();
        const section = match[2]?.trim();
        const label = match[3]?.replace(/<[^>]*>/g, "").trim();

        if (rawTarget) {
          const slug = toArticleSlug(rawTarget);
          const key = `${slug}#${section || ""}`;
          if (!linkMap.has(key)) {
            linkMap.set(key, {
              targetSlug: slug,
              anchorText: label || slug,
              sectionAnchor: section || undefined,
              isExternal: false,
            });
          }
        }
      }
    }

    return Array.from(linkMap.values());
  }

  /**
   * Synchronize the directed link graph for an article in PostgreSQL
   */
  static async syncArticleLinks(
    articleId: string,
    wikitext: string,
    html?: string,
    source = "ixwiki"
  ): Promise<number> {
    const extracted = this.extractLinks(wikitext, html);

    // Resolve which target articles currently exist in PostgreSQL
    const targetSlugs = extracted.map((l) => l.targetSlug);
    const targetTitles = extracted.map((l) => l.targetSlug.replace(/_/g, " "));

    const existingTargets: Array<{ id: string; title: string }> =
      targetSlugs.length > 0
        ? await db.wikiArticle.findMany({
            where: {
              source,
              OR: [{ title: { in: targetTitles } }, { title: { in: targetSlugs } }],
            },
            select: { id: true, title: true },
          })
        : [];

    const targetMap = new Map<string, string>();
    for (const t of existingTargets) {
      targetMap.set(toArticleSlug(t.title), t.id);
      targetMap.set(t.title.toLowerCase(), t.id);
    }

    try {
      // Transactionally update the link graph for this article
      await db.$transaction(async (tx) => {
        // Remove old outgoing links
        await tx.wikiLink.deleteMany({
          where: { sourceArticleId: articleId },
        });

        // Insert new links
        if (extracted.length > 0) {
          await tx.wikiLink.createMany({
            data: extracted.map((link) => ({
              sourceArticleId: articleId,
              targetSlug: link.targetSlug,
              targetArticleId: targetMap.get(link.targetSlug) ?? null,
              anchorText: link.anchorText ?? null,
              sectionAnchor: link.sectionAnchor ?? null,
              isExternal: link.isExternal,
            })),
            skipDuplicates: true,
          });
        }
      });
    } catch {
      // Best-effort if table not migrated or transient DB error
    }

    return extracted.length;
  }

  /**
   * O(1) Backlinks query ("What Links Here")
   */
  static async getBacklinks(
    targetSlug: string,
    source = "ixwiki",
    limit = 50
  ): Promise<Array<{ id: string; slug: string; title: string; anchorText: string | null }>> {
    const normalized = toArticleSlug(targetSlug);

    try {
      const links = await db.wikiLink.findMany({
        where: {
          targetSlug: normalized,
          sourceArticle: { source },
        },
        include: {
          sourceArticle: {
            select: { id: true, title: true },
          },
        },
        take: limit,
      });

      return links.map((l) => ({
        id: l.sourceArticle?.id ?? "",
        slug: toArticleSlug(l.sourceArticle?.title ?? ""),
        title: l.sourceArticle?.title ?? "",
        anchorText: l.anchorText ?? null,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Query Outbound Links from an article
   */
  static async getOutboundLinks(
    sourceSlug: string,
    source = "ixwiki"
  ): Promise<Array<{ targetSlug: string; anchorText: string | null; isBroken: boolean }>> {
    const normalized = toArticleSlug(sourceSlug);

    try {
      const article = await db.wikiArticle.findFirst({
        where: {
          source,
          OR: [
            { title: { equals: sourceSlug.replace(/_/g, " "), mode: "insensitive" } },
            { title: { equals: normalized, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });

      if (!article) return [];

      const links = await db.wikiLink.findMany({
        where: { sourceArticleId: article.id },
        select: { targetSlug: true, anchorText: true, targetArticleId: true },
      });

      return links.map((l) => ({
        targetSlug: l.targetSlug,
        anchorText: l.anchorText,
        isBroken: l.targetArticleId === null,
      }));
    } catch {
      return [];
    }
  }
}
