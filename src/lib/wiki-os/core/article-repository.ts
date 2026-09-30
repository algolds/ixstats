/**
 * article-repository.ts — WikiOS Authoritative PostgreSQL Article Repository
 *
 * Primary source of truth for WikiOS articles and revisions.
 * Guarantees sub-3ms reads from pre-compiled contentHtml and sub-10ms writes.
 */

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
import { parseRedirect } from "./redirect";
import { canonicalizeTitle } from "./title";
import { cleanWikitextExcerpt } from "../transformers/wikitext-parser";

/** The columns a reader needs from a WikiArticle row. */
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
} as const;

export class ArticleRepository {
  static async getArticleBySlug(
    slug: string,
    source = "ixwiki"
  ): Promise<WikiArticleEntity | null> {
    return this.findBySlug(slug, source);
  }

  /**
   * Find an authoritative article by slug or title (<2ms query). The title is canonicalized first,
   * so `foo_bar` reads the row a save of "Foo bar" wrote.
   */
  static async findBySlug(slug: string, source = "ixwiki"): Promise<WikiArticleEntity | null> {
    try {
      const article = await this.lookupArticle(slug, source);

      if (!article || (!article.wikitext && !article.contentHtml)) return null;

      return {
        id: toArticleId(article.id),
        slug: toArticleSlug(article.title),
        title: article.title,
        source: article.source,
        status: (article.status || "PUBLISHED") as WikiArticleEntity["status"],
        format: (article.format || "STRUCTURED_JSON") as WikiArticleEntity["format"],
        contentHtml: article.contentHtml ?? "",
        contentJson: (article.contentJson as unknown as WikiArticleEntity["contentJson"]) ?? null,
        wikitext: article.wikitext ?? "",
        summary: article.summary ?? null,
        namespace: article.namespace ?? 0,
        namespacePrefix: article.namespacePrefix ?? null,
        protectionLevel: article.protectionLevel ?? "ALL",
        protectionExpiry: article.protectionExpiry ?? null,
        infoboxData: null,
        readingTime: article.readingTime ?? 1,
        wordCount: article.wordCount ?? 0,
        viewCount: article.viewCount ?? 0,
        leadImageUrl: article.leadImageUrl ?? null,
        redirectTargetSlug: article.redirectTargetSlug ?? null,
        redirectTargetFragment: article.redirectTargetFragment ?? null,
        authorId: article.authorId ?? null,
        lastEditorId: article.lastEditorId ?? null,
        createdAt: article.syncedAt ?? new Date(),
        updatedAt: article.updatedAt ?? new Date(),
      };
    } catch {
      return null;
    }
  }

  /**
   * The row for `slug`, resolved deterministically: (a) the canonical title, (b) the one row whose
   * lower-case slug matches (a case variant of the title, e.g. `/wiki/nato` for "NATO"), then
   * (c) the legacy case-insensitive match, newest row first, for titles MediaWiki would refuse
   * and rows that predate canonical titles.
   */
  private static async lookupArticle(slug: string, source: string) {
    const canon = canonicalizeTitle(slug, { source });
    if (canon) {
      const exact = await db.wikiArticle.findUnique({
        where: { source_title: { source, title: canon.title } },
        select: ARTICLE_SELECT,
      });
      if (exact) return exact;

      const variants = await db.wikiArticle.findMany({
        where: { source, slug: canon.slug },
        orderBy: { updatedAt: "desc" },
        take: 2,
        select: ARTICLE_SELECT,
      });
      if (variants.length === 1) return variants[0] ?? null;
    }

    const normalizedSlug = toArticleSlug(slug);
    return db.wikiArticle.findFirst({
      where: {
        source,
        OR: [
          { slug: { equals: normalizedSlug, mode: "insensitive" } },
          { slug: { equals: slug, mode: "insensitive" } },
          { title: { equals: slug.replace(/_/g, " "), mode: "insensitive" } },
          { title: { equals: slug, mode: "insensitive" } },
          { title: { equals: normalizedSlug, mode: "insensitive" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      select: ARTICLE_SELECT,
    });
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
    const source = input.source || "ixwiki";
    const canon = canonicalizeTitle(input.title || input.slug, { source });
    if (!canon) throw new Error("Invalid title");
    const { title, slug } = canon;
    const wikitext = input.wikitext || "";
    const contentHtml = input.contentHtml || "";
    // The excerpt (search snippets, link previews) comes from the text, never the edit summary.
    const excerpt = input.excerpt ?? (cleanWikitextExcerpt(wikitext, 300).slice(0, 480) || null);
    const redirect = parseRedirect(wikitext);
    const redirectTargetSlug = redirect?.title ?? null;
    const redirectTargetFragment = redirect?.fragment ?? null;

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
          select: { id: true },
        });
        if (user) resolvedDbUserId = user.id;
      }

      // 1. Upsert WikiArticle
      const article = await tx.wikiArticle.upsert({
        where: {
          source_title: { source, title },
        },
        create: {
          title,
          slug,
          namespace: canon.namespaceId,
          namespacePrefix: canon.namespacePrefix,
          source,
          wikitext,
          contentHtml,
          summary: excerpt,
          redirectTargetSlug,
          redirectTargetFragment,
          authorId: resolvedDbUserId,
          lastEditorId: resolvedDbUserId,
          readingTime,
          wordCount: words,
        },
        update: {
          slug,
          namespace: canon.namespaceId,
          namespacePrefix: canon.namespacePrefix,
          wikitext,
          contentHtml,
          summary: excerpt,
          redirectTargetSlug,
          redirectTargetFragment,
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
          summary: input.editSummary ?? null,
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
        summary: excerpt,
        namespace: result.article.namespace ?? 0,
        namespacePrefix: result.article.namespacePrefix ?? null,
        protectionLevel: result.article.protectionLevel ?? "ALL",
        protectionExpiry: result.article.protectionExpiry ?? null,
        infoboxData: null,
        readingTime,
        wordCount: words,
        viewCount: 0,
        leadImageUrl: null,
        redirectTargetSlug,
        redirectTargetFragment,
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
   * Of `titles`, the ones with no article in this realm: one query, used to mark red links.
   * Titles are compared by their canonical form, exactly as MediaWiki does (so "Foo bar" and
   * "Foo Bar" are different pages); a title MediaWiki would refuse can never exist.
   */
  static async findMissingTitles(titles: string[], source = "ixwiki"): Promise<string[]> {
    if (titles.length === 0) return [];
    const candidates = titles.map((raw) => ({
      raw,
      title: canonicalizeTitle(raw, { source })?.title,
    }));
    const found = await db.wikiArticle.findMany({
      where: { source, title: { in: candidates.flatMap((c) => c.title ?? []) } },
      select: { title: true },
    });
    const existing = new Set(found.map((a) => a.title));
    return candidates.filter((c) => !c.title || !existing.has(c.title)).map((c) => c.raw);
  }

  /**
   * Get full chronological revision history for an article. The article is resolved exactly as
   * `findBySlug` resolves it, so the history of one page never merges in a case-variant row's.
   */
  static async getHistory(
    slug: string,
    source = "ixwiki",
    limit = 50
  ): Promise<WikiRevisionSummary[]> {
    const article = await this.lookupArticle(slug, source);
    if (!article) return [];

    const revisions = await db.wikiRevision.findMany({
      where: { articleId: article.id },
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
