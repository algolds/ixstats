/**
 * link-graph-service.ts — WikiOS Relational Link Graph Engine
 *
 * Maintains the directed graph in `wiki_links` and the transclusion and file-use tables, and
 * delivers O(1) indexed backlink lookups. The data is MediaWiki's own: the render service hands over
 * what `action=parse` reported for an article's links, templates and images, and each `replace*` call
 * swaps that article's whole set inside the transaction it is given. Nothing here reads wikitext.
 */

import type { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { toArticleSlug } from "./domain-types";
import { canonicalizeTitle, type CanonicalTitle } from "./title";

/** Namespaces a link to which is not a link between articles: File, Category, Special, Media. */
const NON_ARTICLE_NAMESPACES: ReadonlySet<number> = new Set([6, 14, -1, -2]);
/** Rows per `createMany` and titles per `IN (...)`: well inside PostgreSQL's bind-parameter limit. */
const BATCH = 2_000;

/** The canonical target of a link, or null when it does not point at an article. */
function articleTarget(rawTarget: string, source: string): CanonicalTitle | null {
  const canon = canonicalizeTitle(rawTarget, { source });
  // File, Category, Special and Media are core MediaWiki namespaces on every wiki, so another
  // wiki's links are checked against IxWiki's table for that (its own titles carry no namespace).
  const namespaceId =
    source === "ixwiki" ? canon?.namespaceId : canonicalizeTitle(rawTarget)?.namespaceId;
  return canon && !NON_ARTICLE_NAMESPACES.has(namespaceId ?? 0) ? canon : null;
}

function inBatches<T>(items: T[]): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += BATCH) batches.push(items.slice(i, i + BATCH));
  return batches;
}

/** Of `titles`, the ids of the published articles that exist, by title. */
async function resolveTargets(
  tx: Prisma.TransactionClient,
  source: string,
  titles: string[]
): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  for (const batch of inBatches(titles)) {
    const rows = await tx.wikiArticle.findMany({
      where: { source, status: "PUBLISHED", title: { in: batch } },
      select: { id: true, title: true },
      take: batch.length,
    });
    for (const row of rows) found.set(row.title, row.id);
  }
  return found;
}

export class LinkGraphService {
  /**
   * Replace the article's outgoing links with the ones the render reported (`links` of `action=parse`:
   * title with its namespace prefix). A link to a page that is not an article (a file, a category, a
   * special page) is not a link between articles; a target that does not exist is a red link
   * (`targetArticleId` null). Resolves to the number of links stored.
   */
  static async replaceLinks(
    tx: Prisma.TransactionClient,
    articleId: string,
    source: string,
    links: ReadonlyArray<{ title: string }>
  ): Promise<number> {
    const targets = new Map<string, CanonicalTitle>();
    for (const link of links) {
      const target = articleTarget(link.title, source);
      if (target) targets.set(target.slug, target);
    }
    const ids = await resolveTargets(
      tx,
      source,
      [...targets.values()].map((target) => target.title)
    );

    await tx.wikiLink.deleteMany({ where: { sourceArticleId: articleId } });
    const rows = [...targets.values()].map((target) => ({
      sourceArticleId: articleId,
      targetSlug: target.slug,
      targetArticleId: ids.get(target.title) ?? null,
      isExternal: false,
    }));
    for (const batch of inBatches(rows)) {
      await tx.wikiLink.createMany({ data: batch, skipDuplicates: true });
    }
    return rows.length;
  }

  /**
   * Replace what the article transcludes with the templates the render reported (Lua modules
   * invoked with #invoke are among them). Resolves to the number of distinct pages.
   */
  static async replaceTemplateLinks(
    tx: Prisma.TransactionClient,
    articleId: string,
    templates: ReadonlyArray<{ title: string }>
  ): Promise<number> {
    const titles = new Set<string>();
    for (const template of templates) {
      const canon = canonicalizeTitle(template.title);
      if (canon) titles.add(canon.title);
    }

    await tx.wikiTemplateLink.deleteMany({ where: { articleId } });
    const rows = [...titles].map((templateTitle) => ({ articleId, templateTitle }));
    for (const batch of inBatches(rows)) {
      await tx.wikiTemplateLink.createMany({ data: batch, skipDuplicates: true });
    }
    return rows.length;
  }

  /**
   * Replace the files the article uses with the ones the render reported (`images` of `action=parse`,
   * names without the "File:" prefix). Resolves to the number of distinct files.
   */
  static async replaceImageLinks(
    tx: Prisma.TransactionClient,
    articleId: string,
    images: readonly string[]
  ): Promise<number> {
    const names = new Set<string>();
    for (const image of images) {
      const canon = canonicalizeTitle(`File:${image}`);
      if (canon) names.add(canon.base);
    }

    await tx.wikiImageLink.deleteMany({ where: { articleId } });
    const rows = [...names].map((fileName) => ({ articleId, fileName }));
    for (const batch of inBatches(rows)) {
      await tx.wikiImageLink.createMany({ data: batch, skipDuplicates: true });
    }
    return rows.length;
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
          sourceArticle: { source, status: "PUBLISHED" },
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
