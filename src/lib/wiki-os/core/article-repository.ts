// The PostgreSQL article repository, WikiOS's source of truth for articles and revisions. It reads the rendered
// view in one query (`findArticleForView`); services/render-service.ts builds the view once per revision.

import type { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import {
  toArticleSlug,
  toArticleId,
  toRevisionId,
  parseRevisionRef,
  toRevisionRef,
  // oxlint-disable-next-line typescript/no-unused-vars
  type ArticleId,
  type HistoryPosition,
  type RevisionId,
  type SaveArticleInput,
  type WikiArticleEntity,
  type WikiRevisionSummary,
} from "./domain-types";
import { EditConflictError, headMatchesBase } from "./edit-conflict-error";
import { lockPageForSave } from "./page-lock";
import { isTransactionBusy, PageBusyError } from "./page-busy-error";
import { parseRedirect } from "./redirect";
import { canonicalizeTitle } from "./title";
import { stripXmlForbiddenControlChars } from "../xml/control-chars";
import { mwSha1Base36 } from "../xml/sha1";
import { cleanWikitextExcerpt } from "../transformers/wikitext-parser";
import { enqueueRevisionJob, scheduleMirrorKick } from "../services/mirror-outbox";
import { enqueueRender, invalidateDependents } from "../services/render-service";
import { notifyWatchers } from "../services/watchlist-notify";
import { importPageRevisions } from "./article-import";

/**
 * The save's transaction: it may wait for the page's lock behind another save (or a long import of the page), so it
 * gets more than Prisma's 5 s, like the staged-file and render-metadata transactions.
 */
export const SAVE_TRANSACTION = { maxWait: 10_000, timeout: 30_000 };

/** A save that waited too long for the page's lock is busy, and retryable: not a failure of the save. */
function retryableWhenBusy(error: unknown): never {
  throw isTransactionBusy(error) ? new PageBusyError() : error;
}

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
  status: true,
  htmlSyncedAt: true,
  // The page's current revision: a parked one (a MediaWiki edit that did not go live) is not its latest.
  revisions: {
    where: { parked: false },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { createdAt: true, byteSize: true, textDeleted: true },
  },
  // A category MediaWiki hides (__HIDDENCAT__, the maintenance and tracking ones) is not shown on the page.
  categories: {
    where: { category: { hidden: false } },
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
  /** PUBLISHED, or ARCHIVED for a deleted page (which only a reader with `deletedhistory` may see). */
  status: string;
  /** When the view bundle was last built from the current wikitext; null = stale or never rendered. */
  htmlSyncedAt: Date | null;
  /** The newest revision's time; null when the article has no revision rows. */
  lastModified: Date | null;
  /**
   * The current revision's text really is empty (0 bytes, not hidden): an empty page, which exists and
   * shows nothing. A row whose text was never imported (no revision, or one with a size but no text) is not.
   */
  emptyText: boolean;
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
    ) ||
      null);
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

export interface FindArticleOptions {
  /** Return a deleted (archived) page too. Default false: to a reader it does not exist. */
  includeArchived?: boolean;
}

type SaveTransaction = Prisma.TransactionClient;

/**
 * The page's latest live revision (a parked one is not the page), as a save under the page's lock reads it. With the
 * locked row's id it reads by `articleId` (the (articleId, parked, createdAt) index: one row, whatever the history's
 * length). Without one (the page had no row when the lock was asked for) the page may have been created by the save
 * that held the advisory lock, so it is found by title.
 */
function loadHeadForSave(
  tx: SaveTransaction,
  source: string,
  title: string,
  articleId: string | null
) {
  return tx.wikiRevision.findFirst({
    where: { ...(articleId ? { articleId } : { article: { source, title } }), parked: false },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, mwRevId: true, byteSize: true },
  });
}

/** The conflict a save that is not based on the page's head hands back: the page as it is, and its head's reference. */
async function conflictOf(
  tx: SaveTransaction,
  source: string,
  title: string,
  head: { id: string; mwRevId: number | null } | null
): Promise<EditConflictError> {
  const current = await tx.wikiArticle.findUnique({
    where: { source_title: { source, title } },
    select: { wikitext: true },
  });
  return new EditConflictError({
    currentWikitext: current?.wikitext ?? "",
    currentRevisionRef: head ? toRevisionRef(head) : null,
  });
}

export class ArticleRepository {
  static async getArticleBySlug(
    slug: string,
    source = "ixwiki",
    options: FindArticleOptions = {}
  ): Promise<ArticleRecord | null> {
    return this.findBySlug(slug, source, options);
  }

  /**
   * Find an authoritative article by slug or title (<2ms query). The title is canonicalized first,
   * so `foo_bar` reads the row a save of "Foo bar" wrote. A row with no wikitext is a stub, not an
   * article, and reads as missing.
   */
  static async findBySlug(
    slug: string,
    source = "ixwiki",
    { includeArchived = false }: FindArticleOptions = {}
  ): Promise<ArticleRecord | null> {
    try {
      const article = await this.lookupArticle(slug, source);
      if (article?.status === "ARCHIVED" && !includeArchived) return null;
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
  static async findArticleForView(
    slug: string,
    source = "ixwiki"
  ): Promise<ArticleViewHead | null> {
    const row = await resolveRow(viewFinders, slug, source);
    if (!row) return null;
    const current = row.revisions[0];
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      htmlSyncedAt: row.htmlSyncedAt,
      lastModified: current?.createdAt ?? null,
      emptyText: current !== undefined && current.byteSize === 0 && !current.textDeleted,
      categories: row.categories.map((member) => member.category.name),
    };
  }

  /**
   * Save an article and create an append-only revision ledger entry (<10ms). The saves of one page run one at a time
   * (the page is locked first, see `lockPageForSave`), the new revision records the live revision it was made on top
   * of (`parentRevisionId`), and with `input.expectedHeadRef` the save throws `EditConflictError` unless that is
   * still the page's latest live revision: the check and the write are one atomic step.
   */
  static async saveArticle(
    input: SaveArticleInput,
    authorId?: string,
    authorName = "Community Contributor"
  ): Promise<{
    article: WikiArticleEntity;
    revisionId: RevisionId;
  }> {
    const source = input.source || "ixwiki";
    const canon = canonicalizeTitle(input.title || input.slug, { source });
    if (!canon) throw new Error("Invalid title");
    const { title, slug } = canon;
    // The text MediaWiki would store: it never holds the control characters XML cannot carry, so the
    // hash of what is saved matches the dump's and MediaWiki's (F25).
    const wikitext = stripXmlForbiddenControlChars(input.wikitext || "");
    // Rendered HTML is the render service's to write; a save only stores HTML a caller hands it.
    const providedHtml = input.contentHtml || undefined;
    const fields = deriveSaveFields(input, wikitext, providedHtml);
    const { excerpt, redirectTargetSlug, redirectTargetFragment, words, readingTime } = fields;

    // Save article and create revision in a single atomic transaction
    const result = await db
      .$transaction(async (tx) => {
        // 0. Queue behind any other save of this page, then read the head it left: the edit-conflict check, the byte
        // delta and the new revision's parent all come from this one read.
        const lockedId = await lockPageForSave(tx, source, title);
        const previous = await loadHeadForSave(tx, source, title, lockedId);
        if (
          input.expectedHeadRef !== undefined &&
          !headMatchesBase(previous, input.expectedHeadRef)
        ) {
          throw await conflictOf(tx, source, title, previous);
        }

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

        // Is the text any different? Compared in the database: the stored text never crosses the wire.
        const textUnchanged =
          (await tx.wikiArticle.count({ where: { source, title, wikitext } })) > 0;

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
            // A changed text marks the view stale (`htmlSyncedAt: null`); the previous HTML and
            // bundle stay in place, readers keep seeing them until the render queued below replaces them.
            ...(providedHtml ? { contentHtml: providedHtml } : {}),
            ...(textUnchanged ? {} : { htmlSyncedAt: null }),
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

        // 2. Create append-only revision, sized against the previous one and made on top of it
        const byteSize = Buffer.byteLength(wikitext, "utf8");
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
            parentRevisionId: previous?.id ?? null,
            byteSize,
            byteDelta: byteSize - (previous?.byteSize ?? 0),
            sha1: mwSha1Base36(wikitext),
          },
          select: {
            id: true,
            articleId: true,
            summary: true,
            minor: true,
            author: true,
            authorId: true,
            createdAt: true,
          },
        });

        // 3. The revision's MediaWiki mirror job, in the same transaction: a committed edit always has it.
        await enqueueRevisionJob(tx, {
          title: article.title,
          articleId: article.id,
          revisionId: revision.id,
          source,
        });

        return { article, revision, textUnchanged, previous };
      }, SAVE_TRANSACTION)
      .catch(retryableWhenBusy);
    // The job is committed: let the mirror worker send it to MediaWiki in a moment, not at the next cron minute.
    scheduleMirrorKick();

    // 4. Render the new text off the read path (the commit above marked the old view stale). The render
    // also fills the link graph, the template and image links and the categories (render-service.ts);
    // pages that transclude this one are stale now too.
    if (!result.textUnchanged) {
      enqueueRender(result.article.id);
      void invalidateDependents(title, source);
      // watchlist: tell the page's watchers (once each until they visit); the editor is left out.
      void notifyWatchers({
        kind: "edited",
        articleId: result.article.id,
        title: result.article.title,
        editor: authorName,
        editorUserId: result.revision.authorId,
        summary: result.revision.summary,
        previousRef: result.previous ? toRevisionRef(result.previous) : null,
        currentRef: toRevisionRef(result.revision),
      });
    }

    return {
      article: toSavedEntity(result.article, fields, providedHtml, authorId),
      revisionId: toRevisionId(result.revision.id),
    };
  }

  /** Imports one page's revisions from an XML dump, atomically (article-import.ts). */
  static importPageRevisions = importPageRevisions;

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
      where: {
        source,
        status: { not: "ARCHIVED" }, // a deleted page is a red link
        title: { in: candidates.flatMap((c) => c.title ?? []) },
      },
      select: { title: true },
    });
    const existing = new Set(found.map((a) => a.title));
    return candidates.filter((c) => !c.title || !existing.has(c.title)).map((c) => c.raw);
  }

  /**
   * The revision history of an article, newest first, without any revision's text. The article is
   * resolved exactly as `findBySlug` resolves it, so the history of one page never merges in a
   * case-variant row's. `position` pages through it: `{ before }` starts right after that revision
   * (the "older" page), `{ from }` at that revision itself; a reference to no revision of this
   * article is an empty page. Parked revisions (MediaWiki edits that did not go live) are left out
   * of the rows and of the position's lookup, so the first entry is the page's current revision; a
   * history list asks for them with `includeParked` and gets them flagged.
   */
  static async getHistory(
    slug: string,
    source = "ixwiki",
    limit = 50,
    position?: HistoryPosition,
    { includeParked = false }: { includeParked?: boolean } = {}
  ): Promise<WikiRevisionSummary[]> {
    const article = await this.lookupArticle(slug, source);
    if (!article) return [];

    let page: { cursor: { id: string }; skip?: number } | undefined;
    if (position) {
      const ref = "before" in position ? position.before : position.from;
      const key = parseRevisionRef(ref);
      const anchor = await db.wikiRevision.findFirst({
        where: {
          articleId: article.id,
          ...("mwRevId" in key ? { mwRevId: key.mwRevId } : { id: key.id }),
          ...(includeParked ? {} : { parked: false }),
        },
        select: { id: true },
      });
      if (!anchor) return [];
      page = "before" in position ? { cursor: anchor, skip: 1 } : { cursor: anchor };
    }

    const revisions = await db.wikiRevision.findMany({
      where: { articleId: article.id, ...(includeParked ? {} : { parked: false }) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      ...page,
      select: {
        id: true,
        mwRevId: true,
        summary: true,
        minor: true,
        author: true,
        createdAt: true,
        byteSize: true,
        byteDelta: true,
        sha1: true,
        parked: true,
        textDeleted: true,
        commentDeleted: true,
        userDeleted: true,
      },
    });

    return revisions.map((r) => ({
      id: toRevisionId(r.id),
      mwRevId: r.mwRevId,
      articleId: toArticleId(article.id),
      summary: r.summary ?? null,
      minor: r.minor ?? false,
      author: r.author ?? null,
      createdAt: r.createdAt,
      byteSize: r.byteSize,
      byteDelta: r.byteDelta ?? 0,
      sha1: r.sha1 ?? null,
      parked: r.parked,
      textDeleted: r.textDeleted,
      commentDeleted: r.commentDeleted,
      userDeleted: r.userDeleted,
    }));
  }
}
