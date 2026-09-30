/**
 * article-repository.ts — WikiOS Authoritative PostgreSQL Article Repository
 *
 * Primary source of truth for WikiOS articles and revisions.
 * Reads the article's rendered view in one sub-3ms query (`findArticleForView`) and writes in sub-10ms;
 * the view itself is built once per revision by services/render-service.ts.
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
import { enqueueRender } from "../services/render-service";

/** `WikiArticle.summary` is a VarChar(500); the excerpt stays under it. */
const MAX_EXCERPT_LENGTH = 480;
/** The excerpt is the lead of the article: cleaning more than this is wasted work on a 2 MB page. */
const EXCERPT_SOURCE_LENGTH = 20_000;
/** Category names shown with an article view. */
const MAX_VIEW_CATEGORIES = 50;

/**
 * The columns a wikitext reader needs from a WikiArticle row. The rendered HTML is not one of them:
 * the reader gets it through `findArticleForView` and the render service.
 */
const ARTICLE_SELECT = {
  id: true,
  title: true,
  source: true,
  status: true,
  format: true,
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

/**
 * What the article reader needs to find a page's rendered view: never the wikitext, the raw HTML or
 * the view bundle itself (the bundle is read only on a view-cache miss, see `loadViewBundle`).
 */
const VIEW_SELECT = {
  id: true,
  title: true,
  htmlSyncedAt: true,
  revisions: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
  categories: {
    orderBy: { category: { name: "asc" } },
    take: MAX_VIEW_CATEGORIES,
    select: { category: { select: { name: true } } },
  },
} as const;

/** `WikiArticleEntity` without the rendered HTML, which `findBySlug` does not read (see `ARTICLE_SELECT`). */
export type ArticleRecord = Omit<WikiArticleEntity, "contentHtml" | "contentJson">;

export interface ArticleViewHead {
  id: string;
  /** The canonical title as stored. */
  title: string;
  /** When the view bundle was last built from the current wikitext; null = stale or never rendered. */
  htmlSyncedAt: Date | null;
  /** The newest revision's time; null when the article has no revision rows. */
  lastModified: Date | null;
  /** Category names, alphabetical, at most `MAX_VIEW_CATEGORIES`. */
  categories: string[];
}

/** One lookup per resolution step; `Row` is whatever the finders' own `select` returns. */
interface RowFinders<Row> {
  exact(source: string, title: string): PromiseLike<Row | null>;
  bySlug(source: string, slug: string): PromiseLike<Row[]>;
  loose(source: string, slug: string): PromiseLike<Row | null>;
}

/** The legacy case-insensitive match, for titles MediaWiki would refuse and rows that predate canonical titles. */
function looseWhere(source: string, slug: string) {
  const normalizedSlug = toArticleSlug(slug);
  return {
    source,
    OR: [
      { slug: { equals: normalizedSlug, mode: "insensitive" as const } },
      { slug: { equals: slug, mode: "insensitive" as const } },
      { title: { equals: slug.replace(/_/g, " "), mode: "insensitive" as const } },
      { title: { equals: slug, mode: "insensitive" as const } },
      { title: { equals: normalizedSlug, mode: "insensitive" as const } },
    ],
  };
}

const articleFinders = {
  exact: (source: string, title: string) =>
    db.wikiArticle.findUnique({
      where: { source_title: { source, title } },
      select: ARTICLE_SELECT,
    }),
  bySlug: (source: string, slug: string) =>
    db.wikiArticle.findMany({
      where: { source, slug },
      orderBy: { updatedAt: "desc" },
      take: 2,
      select: ARTICLE_SELECT,
    }),
  loose: (source: string, slug: string) =>
    db.wikiArticle.findFirst({
      where: looseWhere(source, slug),
      orderBy: { updatedAt: "desc" },
      select: ARTICLE_SELECT,
    }),
};

const viewFinders = {
  exact: (source: string, title: string) =>
    db.wikiArticle.findUnique({
      where: { source_title: { source, title } },
      select: VIEW_SELECT,
    }),
  bySlug: (source: string, slug: string) =>
    db.wikiArticle.findMany({
      where: { source, slug },
      orderBy: { updatedAt: "desc" },
      take: 2,
      select: VIEW_SELECT,
    }),
  loose: (source: string, slug: string) =>
    db.wikiArticle.findFirst({
      where: looseWhere(source, slug),
      orderBy: { updatedAt: "desc" },
      select: VIEW_SELECT,
    }),
};

type ArticleRow = NonNullable<Awaited<ReturnType<typeof articleFinders.exact>>>;

function toArticleRecord(article: ArticleRow): ArticleRecord {
  return {
    id: toArticleId(article.id),
    slug: toArticleSlug(article.title),
    title: article.title,
    source: article.source,
    status: (article.status || "PUBLISHED") as ArticleRecord["status"],
    format: (article.format || "STRUCTURED_JSON") as ArticleRecord["format"],
    wikitext: article.wikitext,
    summary: article.summary ?? null,
    namespace: article.namespace,
    namespacePrefix: article.namespacePrefix ?? null,
    protectionLevel: article.protectionLevel,
    protectionExpiry: article.protectionExpiry ?? null,
    infoboxData: null,
    readingTime: article.readingTime,
    wordCount: article.wordCount,
    viewCount: article.viewCount,
    leadImageUrl: article.leadImageUrl ?? null,
    redirectTargetSlug: article.redirectTargetSlug ?? null,
    redirectTargetFragment: article.redirectTargetFragment ?? null,
    authorId: article.authorId ?? null,
    lastEditorId: article.lastEditorId ?? null,
    createdAt: article.syncedAt,
    updatedAt: article.updatedAt,
  };
}

/**
 * What a save derives from its text alone: the excerpt (search snippets, link previews; from the
 * text, never the edit summary), the redirect target, the word count and the reading time.
 */
function deriveSaveFields(input: SaveArticleInput, wikitext: string, providedHtml?: string) {
  const excerpt =
    input.excerpt?.slice(0, MAX_EXCERPT_LENGTH) ??
    (cleanWikitextExcerpt(wikitext.slice(0, EXCERPT_SOURCE_LENGTH), 300).slice(
      0,
      MAX_EXCERPT_LENGTH
    ) || null);
  const redirect = parseRedirect(wikitext);
  const words = (wikitext || providedHtml || "").split(/\s+/).filter(Boolean).length;
  return {
    excerpt,
    redirectTargetSlug: redirect?.title ?? null,
    redirectTargetFragment: redirect?.fragment ?? null,
    words,
    readingTime: Math.max(1, Math.ceil(words / 200)),
  };
}

type SaveFields = ReturnType<typeof deriveSaveFields>;

interface SavedRow {
  id: string;
  title: string;
  source: string;
  wikitext: string;
  namespace: number;
  namespacePrefix: string | null;
  protectionLevel: string;
  protectionExpiry: Date | null;
  syncedAt: Date;
  updatedAt: Date;
}

/** The entity `saveArticle` answers with: the saved row plus what the save derived. */
function toSavedEntity(
  row: SavedRow,
  fields: SaveFields,
  providedHtml: string | undefined,
  authorId: string | undefined
): WikiArticleEntity {
  return {
    id: toArticleId(row.id),
    slug: toArticleSlug(row.title),
    title: row.title,
    source: row.source,
    status: "PUBLISHED",
    format: "STRUCTURED_JSON",
    contentHtml: providedHtml ?? "",
    contentJson: null,
    wikitext: row.wikitext,
    summary: fields.excerpt,
    namespace: row.namespace,
    namespacePrefix: row.namespacePrefix,
    protectionLevel: row.protectionLevel,
    protectionExpiry: row.protectionExpiry,
    infoboxData: null,
    readingTime: fields.readingTime,
    wordCount: fields.words,
    viewCount: 0,
    leadImageUrl: null,
    redirectTargetSlug: fields.redirectTargetSlug,
    redirectTargetFragment: fields.redirectTargetFragment,
    authorId: authorId ?? null,
    lastEditorId: authorId ?? null,
    createdAt: row.syncedAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Resolve `slug` to one row: (a) the canonical title, (b) the one row whose lower-case slug matches
 * (a case variant of the title), then (c) the legacy case-insensitive match. Each step is the
 * finders' own query, so the caller's `select` decides what is read.
 */
async function resolveRow<Row>(
  finders: RowFinders<Row>,
  slug: string,
  source: string
): Promise<Row | null> {
  const canon = canonicalizeTitle(slug, { source });
  if (canon) {
    const exact = await finders.exact(source, canon.title);
    if (exact) return exact;

    const variants = await finders.bySlug(source, canon.slug);
    if (variants.length === 1) return variants[0] ?? null;
  }
  return finders.loose(source, slug);
}

export class ArticleRepository {
  static async getArticleBySlug(slug: string, source = "ixwiki"): Promise<ArticleRecord | null> {
    return this.findBySlug(slug, source);
  }

  /**
   * Find an authoritative article by slug or title (<2ms query). The title is canonicalized first,
   * so `foo_bar` reads the row a save of "Foo bar" wrote. A row with no wikitext is a stub, not an
   * article, and reads as missing.
   */
  static async findBySlug(slug: string, source = "ixwiki"): Promise<ArticleRecord | null> {
    try {
      const article = await this.lookupArticle(slug, source);
      return article?.wikitext ? toArticleRecord(article) : null;
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
  private static lookupArticle(slug: string, source: string) {
    return resolveRow(articleFinders, slug, source);
  }

  /**
   * The article the reader shows for `slug`, resolved exactly as `findBySlug` resolves it but
   * reading only what locating the rendered view takes (one query). Database errors propagate:
   * a missing article and a failed lookup are not the same answer. Unlike `findBySlug` a row
   * with no wikitext is returned: it may hold only rendered HTML, and the reader decides.
   */
  static async findArticleForView(slug: string, source = "ixwiki"): Promise<ArticleViewHead | null> {
    const row = await resolveRow(viewFinders, slug, source);
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      htmlSyncedAt: row.htmlSyncedAt,
      lastModified: row.revisions[0]?.createdAt ?? null,
      categories: row.categories.map((member) => member.category.name),
    };
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
    // Rendered HTML is the render service's to write; a save only stores HTML a caller hands it.
    const providedHtml = input.contentHtml || undefined;
    const fields = deriveSaveFields(input, wikitext, providedHtml);
    const { excerpt, redirectTargetSlug, redirectTargetFragment, words, readingTime } = fields;

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
          contentHtml: providedHtml,
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
          // The previous HTML and view bundle stay in place (readers keep seeing them) until the
          // render queued below replaces them; `htmlSyncedAt: null` is what marks them stale.
          ...(providedHtml ? { contentHtml: providedHtml } : {}),
          htmlSyncedAt: null,
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
          contentHtml: providedHtml,
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

    // 3. Render the new text off the read path (the commit above marked the old view stale)
    enqueueRender(result.article.id);

    // 4. Update the link graph outside transaction for performance
    let linksCount = 0;
    try {
      linksCount = await LinkGraphService.syncArticleLinks(
        result.article.id,
        wikitext,
        providedHtml ?? "",
        source
      );
    } catch (linkErr) {
      console.warn("[ArticleRepository] Best-effort link graph sync failed:", linkErr);
    }

    // 5. Auto-register any new image references in PostgreSQL wiki_assets
    void MediaAssetService.processContentImages(wikitext || providedHtml || "").catch((err) => {
      console.warn("[ArticleRepository] Media asset processing failed:", err);
    });

    return {
      article: toSavedEntity(result.article, fields, providedHtml, authorId),
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
