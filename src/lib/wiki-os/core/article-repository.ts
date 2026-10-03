/**
 * Authoritative PostgreSQL repository for WikiOS articles and revisions: sub-3ms reads from
 * pre-compiled contentHtml and sub-10ms writes.
 */

import type { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import {
  toArticleSlug,
  toArticleId,
  toRevisionId,
  // oxlint-disable-next-line typescript/no-unused-vars
  type ArticleId,
  type RevisionId,
  type SaveArticleInput,
  type WikiArticleEntity,
  type WikiRevisionSummary,
} from "./domain-types";
import { LinkGraphService } from "./link-graph-service";
import { MediaAssetService } from "./media-asset-service";

/** Matches an article by slug or title, in any of the forms callers pass (slug, spaced title). */
function articleLookupFilter(slug: string) {
  const normalized = toArticleSlug(slug);
  const insensitive = (value: string) => ({ equals: value, mode: "insensitive" as const });
  return [
    { slug: insensitive(normalized) },
    { slug: insensitive(slug) },
    { title: insensitive(slug.replace(/_/g, " ")) },
    { title: insensitive(slug) },
    { title: insensitive(normalized) },
  ];
}

const ARTICLE_SELECT = {
  id: true,
  title: true,
  source: true,
  status: true,
  format: true,
  contentHtml: true,
  contentJson: true,
  wikitext: true,
  summary: true,
  namespace: true,
  namespacePrefix: true,
  protectionLevel: true,
  protectionExpiry: true,
  redirectTargetSlug: true,
  redirectTargetFragment: true,
  readingTime: true,
  wordCount: true,
  viewCount: true,
  leadImageUrl: true,
  authorId: true,
  lastEditorId: true,
  syncedAt: true,
  updatedAt: true,
} as const satisfies Prisma.WikiArticleSelect;

/** Entity values for columns that are null in the database. */
const ENTITY_DEFAULTS = {
  contentHtml: "",
  wikitext: "",
  summary: null,
  namespace: 0,
  namespacePrefix: null,
  protectionLevel: "ALL",
  protectionExpiry: null,
  infoboxData: null,
  readingTime: 1,
  wordCount: 0,
  viewCount: 0,
  leadImageUrl: null,
  redirectTargetSlug: null,
  redirectTargetFragment: null,
  authorId: null,
  lastEditorId: null,
} satisfies Partial<WikiArticleEntity>;

/** The object without its null/undefined values, so defaults spread under it survive. */
const defined = <T extends object>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, value]) => value != null)) as Partial<T>;

function toArticleEntity(article: Prisma.WikiArticleGetPayload<{ select: typeof ARTICLE_SELECT }>) {
  const { syncedAt, ...columns } = article;
  const entity: WikiArticleEntity = {
    ...ENTITY_DEFAULTS,
    ...defined(columns),
    id: toArticleId(article.id),
    slug: toArticleSlug(article.title),
    status: (article.status || "PUBLISHED") as WikiArticleEntity["status"],
    format: (article.format || "STRUCTURED_JSON") as WikiArticleEntity["format"],
    contentJson: (article.contentJson as unknown as WikiArticleEntity["contentJson"]) ?? null,
    createdAt: syncedAt ?? new Date(),
    updatedAt: article.updatedAt ?? new Date(),
  };
  return entity;
}

export class ArticleRepository {
  static async getArticleBySlug(
    slug: string,
    source = "ixwiki"
  ): Promise<WikiArticleEntity | null> {
    return this.findBySlug(slug, source);
  }

  /**
   * Find an authoritative article by slug (<2ms query)
   */
  static async findBySlug(slug: string, source = "ixwiki"): Promise<WikiArticleEntity | null> {
    try {
      const article = await db.wikiArticle.findFirst({
        where: { source, OR: articleLookupFilter(slug) },
        select: ARTICLE_SELECT,
      });
      if (!article || (!article.wikitext && !article.contentHtml)) return null;
      return toArticleEntity(article);
    } catch {
      return null;
    }
  }

  /**
   * Save an article and create an append-only revision ledger entry (<10ms)
   */
  static async saveArticle(
    input: SaveArticleInput,
    authorId?: string,
    authorName = "Community Contributor"
  ): Promise<{
    article: WikiArticleEntity;
    revisionId: RevisionId;
    extractedLinksCount: number;
  }> {
    const slug = toArticleSlug(input.slug || input.title);
    const source = input.source || "ixwiki";
    const title = input.title || input.slug.replace(/_/g, " ");
    const wikitext = input.wikitext || "";
    const contentHtml = input.contentHtml || "";

    // Compute basic word count and reading time
    const words = (wikitext || contentHtml).split(/\s+/).filter(Boolean).length;
    const readingTime = Math.max(1, Math.ceil(words / 200));

    // Save article and create revision in a single atomic transaction
    const result = await db.$transaction(async (tx) => {
      // Resolve DB user id if Clerk ID or username was provided
      let resolvedDbUserId: string | null = null;
      if (authorId) {
        const user = await tx.user.findFirst({
          where: {
            OR: [{ id: authorId }, { clerkUserId: authorId }],
          },
          select: { id: true, wikiUsername: true },
        });
        if (user) {
          resolvedDbUserId = user.id;
          if (!user.wikiUsername && authorName && authorName !== "Community Contributor") {
            await tx.user
              .update({
                where: { id: user.id },
                data: { wikiUsername: authorName, lastWikiSync: new Date() },
              })
              .catch(() => null);
          }
        }
      }

      // 1. Upsert WikiArticle
      const article = await tx.wikiArticle.upsert({
        where: {
          source_title: { source, title },
        },
        create: {
          title,
          slug,
          source,
          wikitext,
          contentHtml,
          summary: input.summary ?? null,
          authorId: resolvedDbUserId,
          lastEditorId: resolvedDbUserId,
          readingTime,
          wordCount: words,
        },
        update: {
          wikitext,
          contentHtml,
          summary: input.summary ?? undefined,
          lastEditorId: resolvedDbUserId ?? undefined,
          syncedAt: new Date(),
          readingTime,
          wordCount: words,
        },
        select: {
          id: true,
          title: true,
          slug: true,
          source: true,
          wikitext: true,
          namespace: true,
          namespacePrefix: true,
          protectionLevel: true,
          protectionExpiry: true,
          syncedAt: true,
          updatedAt: true,
        },
      });

      // 2. Create append-only revision, sized against the previous one
      const byteSize = Buffer.byteLength(wikitext, "utf8");
      const previous = await tx.wikiRevision.findFirst({
        where: { articleId: article.id },
        orderBy: { createdAt: "desc" },
        select: { byteSize: true },
      });
      const revision = await tx.wikiRevision.create({
        data: {
          articleId: article.id,
          wikitext,
          contentHtml,
          summary: input.summary ?? null,
          minor: input.minor ?? false,
          source,
          author: authorName,
          authorId: resolvedDbUserId,
          byteSize,
          byteDelta: byteSize - (previous?.byteSize ?? 0),
        },
        select: {
          id: true,
          articleId: true,
          summary: true,
          minor: true,
          author: true,
          createdAt: true,
        },
      });

      return { article, revision };
    });

    // 3. Update the link graph outside transaction for performance
    let linksCount = 0;
    try {
      linksCount = await LinkGraphService.syncArticleLinks(
        result.article.id,
        wikitext,
        contentHtml,
        source
      );
    } catch (linkErr) {
      console.warn("[ArticleRepository] Best-effort link graph sync failed:", linkErr);
    }

    // 4. Auto-register any new image references in PostgreSQL wiki_assets
    void MediaAssetService.processContentImages(wikitext || contentHtml).catch((err) => {
      console.warn("[ArticleRepository] Media asset processing failed:", err);
    });

    return {
      article: {
        id: toArticleId(result.article.id),
        slug: toArticleSlug(result.article.title),
        title: result.article.title,
        source: result.article.source,
        status: "PUBLISHED",
        format: "STRUCTURED_JSON",
        contentHtml: contentHtml || "",
        contentJson: null,
        wikitext: result.article.wikitext,
        summary: input.summary ?? null,
        namespace: result.article.namespace ?? 0,
        namespacePrefix: result.article.namespacePrefix ?? null,
        protectionLevel: result.article.protectionLevel ?? "ALL",
        protectionExpiry: result.article.protectionExpiry ?? null,
        infoboxData: null,
        readingTime,
        wordCount: words,
        viewCount: 0,
        leadImageUrl: null,
        redirectTargetSlug: null,
        redirectTargetFragment: null,
        authorId: authorId ?? null,
        lastEditorId: authorId ?? null,
        createdAt: result.article.syncedAt || new Date(),
        updatedAt: result.article.updatedAt || new Date(),
      },
      revisionId: toRevisionId(result.revision.id),
      extractedLinksCount: linksCount,
    };
  }

  /**
   * Of `titles`, the ones with no article in this realm — one query, used to mark red links.
   */
  static async findMissingTitles(titles: string[], source = "ixwiki"): Promise<string[]> {
    if (titles.length === 0) return [];
    const found = await db.wikiArticle.findMany({
      where: {
        source,
        OR: [{ slug: { in: titles.map((t) => toArticleSlug(t)) } }, { title: { in: titles } }],
      },
      select: { slug: true, title: true },
    });
    const existing = new Set(found.flatMap((a) => [toArticleSlug(a.slug), toArticleSlug(a.title)]));
    return titles.filter((t) => !existing.has(toArticleSlug(t)));
  }

  /**
   * Get full chronological revision history for an article
   */
  static async getHistory(
    slug: string,
    source = "ixwiki",
    limit = 50
  ): Promise<WikiRevisionSummary[]> {
    const revisions = await db.wikiRevision.findMany({
      where: { article: { source, OR: articleLookupFilter(slug) } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        mwRevId: true,
        articleId: true,
        summary: true,
        minor: true,
        author: true,
        authorId: true,
        createdAt: true,
        wikitext: true,
        byteSize: true,
        byteDelta: true,
        format: true,
      },
    });

    return revisions.map((r) => ({
      id: toRevisionId(r.id),
      mwRevId: r.mwRevId,
      articleId: toArticleId(r.articleId),
      format: (r.format || "STRUCTURED_JSON") as WikiRevisionSummary["format"],
      summary: r.summary ?? null,
      minor: r.minor ?? false,
      author: r.author ?? null,
      authorId: r.authorId ?? null,
      createdAt: r.createdAt,
      byteSize: r.byteSize || Buffer.byteLength(r.wikitext || "", "utf8"),
      byteDelta: r.byteDelta ?? 0,
    }));
  }
}
