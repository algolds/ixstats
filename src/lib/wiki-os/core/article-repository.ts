/**
 * article-repository.ts — WikiOS Authoritative PostgreSQL Article Repository
 *
 * Primary source of truth for WikiOS articles and revisions.
 * Guarantees sub-3ms reads from pre-compiled contentHtml and sub-10ms writes.
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
import { parseRedirect } from "./redirect";
import { canonicalizeTitle } from "./title";
import {
  planRevisionImport,
  type ExistingRevisionRow,
  type ImportedRevision,
  type RevisionPlan,
} from "../xml/revision-plan";
import { mwSha1Base36 } from "../xml/sha1";
import { cleanWikitextExcerpt } from "../transformers/wikitext-parser";

/** `WikiArticle.summary` is a VarChar(500); the excerpt stays under it. */
const MAX_EXCERPT_LENGTH = 480;
/** The excerpt is the lead of the article: cleaning more than this is wasted work on a 2 MB page. */
const EXCERPT_SOURCE_LENGTH = 20_000;

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

/** The article fields an imported head revision writes (computed by the importer from its wikitext). */
export interface ImportedHead {
  /** The head revision's timestamp: it only replaces a current head that is older. */
  createdAt: Date;
  mwRevId: number | null;
  wikitext: string;
  summary: string | null;
  wordCount: number;
  readingTime: number;
  /** Canonical title of the redirect target, or null when the head is not a redirect. */
  redirectTargetSlug: string | null;
  redirectTargetFragment: string | null;
}

export interface ImportPageInput {
  source: string;
  /** Canonical title (`canonicalizeTitle`). */
  title: string;
  slug: string;
  namespace: number;
  namespacePrefix: string | null;
  mwPageId: number | null;
  /** Protection from a dump's legacy `<restrictions>`; only ever applied to an unprotected page. */
  protectionLevel: "SYSOP" | "AUTOCONFIRMED" | null;
  /** The dump's revisions, oldest first. */
  revisions: ImportedRevision[];
  /** The newest dump revision that has text, or null when none does. */
  head: ImportedHead | null;
  /** Read and plan, write nothing. */
  dryRun: boolean;
}

export interface ImportPageResult {
  /** The page did not exist (a dry run reports it, a real run created it). */
  created: boolean;
  inserted: number;
  /** Empty placeholder revisions that received their text. */
  filled: number;
  /** Revisions the page already had (including twins that only got their rev id). */
  skipped: number;
  /** Revisions whose rev id already belongs to another page. */
  conflicts: number;
  /** The page's wikitext, redirect and render state now come from the dump's head revision. */
  headUpdated: boolean;
}

/** One page is imported atomically; a long history needs far more than Prisma's 5 s default. */
const IMPORT_TRANSACTION = { maxWait: 10_000, timeout: 300_000 } as const;
/** Rows per `createMany` and ids per `IN (...)`: well inside PostgreSQL's bind-parameter limit. */
const IMPORT_BATCH = 500;
/** An explicit `take` for reads that must not be cut short (the read-only db guard caps a findMany without one at 1000 rows). */
const ALL_ROWS = 2_147_483_647;

type ImportClient = Prisma.TransactionClient;
type ExistingArticle = { id: string; mwPageId: number | null; protectionLevel: string };

/**
 * The page's rows that have text but no hash (written before `sha1` existed), hashed from their
 * text, by row id. Only rows that can be a dump revision's twin are read: WikiOS's own edits (no
 * MediaWiki rev id), or all of them when the dump has revisions without an id.
 */
async function hashUnhashedRows(
  client: ImportClient,
  input: ImportPageInput,
  articleId: string | null
): Promise<Map<string, string>> {
  if (!articleId) return new Map();
  const dumpHasIdless = input.revisions.some((revision) => revision.mwRevId === null);
  const unhashed = await client.wikiRevision.findMany({
    where: {
      articleId,
      sha1: null,
      textDeleted: false,
      wikitext: { not: "" },
      ...(dumpHasIdless ? {} : { mwRevId: null }),
    },
    select: { id: true, wikitext: true },
    take: ALL_ROWS,
  });
  return new Map(unhashed.map((row) => [row.id, mwSha1Base36(row.wikitext)]));
}

/**
 * Stored rows of the page, plus any row anywhere that carries one of the dump's rev ids, and the
 * hashes computed for rows that had none (`hashed`: to be written back by a real import).
 */
async function loadExistingRows(
  client: ImportClient,
  input: ImportPageInput,
  articleId: string | null
): Promise<{ rows: ExistingRevisionRow[]; hashed: Map<string, string> }> {
  const select = { id: true, articleId: true, mwRevId: true, sha1: true, createdAt: true } as const;
  const revIds = input.revisions.flatMap((r) => (r.mwRevId === null ? [] : [r.mwRevId]));
  const rows = articleId
    ? await client.wikiRevision.findMany({ where: { articleId }, select, take: ALL_ROWS })
    : [];
  for (let i = 0; i < revIds.length; i += IMPORT_BATCH) {
    rows.push(
      ...(await client.wikiRevision.findMany({
        where: {
          source: input.source,
          mwRevId: { in: revIds.slice(i, i + IMPORT_BATCH) },
          ...(articleId ? { articleId: { not: articleId } } : {}),
        },
        select,
      }))
    );
  }
  const blank = articleId
    ? await client.wikiRevision.findMany({
        where: { articleId, wikitext: "", textDeleted: false },
        select: { id: true },
        take: ALL_ROWS,
      })
    : [];
  const blankIds = new Set(blank.map((row) => row.id));
  const hashed = await hashUnhashedRows(client, input, articleId);
  return {
    rows: rows.map((row) => ({
      ...row,
      sha1: row.sha1 ?? hashed.get(row.id) ?? null,
      isPlaceholder: blankIds.has(row.id),
    })),
    hashed,
  };
}

/** The article columns that change when the dump's head revision becomes the page's head. */
function headColumns(input: ImportPageInput, head: ImportedHead) {
  return {
    wikitext: head.wikitext,
    // The reader prefers cached HTML, so a changed head must clear it (see syncPageOrThrow).
    contentHtml: "",
    htmlSyncedAt: null,
    summary: head.summary,
    wordCount: head.wordCount,
    readingTime: head.readingTime,
    mwLatestRevId: head.mwRevId,
    redirectTargetSlug: head.redirectTargetSlug,
    redirectTargetFragment: head.redirectTargetFragment,
    namespace: input.namespace,
    namespacePrefix: input.namespacePrefix,
  };
}

async function insertRevisions(
  client: ImportClient,
  articleId: string,
  source: string,
  revisions: ImportedRevision[]
): Promise<void> {
  for (let i = 0; i < revisions.length; i += IMPORT_BATCH) {
    await client.wikiRevision.createMany({
      data: revisions.slice(i, i + IMPORT_BATCH).map((revision) => ({
        articleId,
        source,
        mwRevId: revision.mwRevId,
        author: revision.author,
        authorId: revision.authorId,
        summary: revision.summary,
        minor: revision.minor,
        textDeleted: revision.textDeleted,
        commentDeleted: revision.commentDeleted,
        userDeleted: revision.userDeleted,
        byteSize: revision.byteSize,
        byteDelta: revision.byteDelta,
        sha1: revision.sha1,
        createdAt: revision.createdAt,
        wikitext: revision.wikitext ?? "",
        format: "WIKITEXT",
      })),
    });
  }
}

/** Create the page, or bring an existing one up to date; resolves to its id. */
async function writeArticle(
  client: ImportClient,
  input: ImportPageInput,
  article: ExistingArticle | null,
  head: ImportedHead | null
): Promise<string> {
  const protection = input.protectionLevel ?? undefined;
  const headData = head ? headColumns(input, head) : {};
  if (!article) {
    const created = await client.wikiArticle.create({
      data: {
        title: input.title,
        slug: input.slug,
        source: input.source,
        status: "PUBLISHED",
        format: "WIKITEXT",
        namespace: input.namespace,
        namespacePrefix: input.namespacePrefix,
        mwPageId: input.mwPageId,
        protectionLevel: protection,
        wikitext: "",
        ...headData,
      },
      select: { id: true },
    });
    return created.id;
  }

  const data = {
    ...headData,
    ...(article.mwPageId === null && input.mwPageId !== null ? { mwPageId: input.mwPageId } : {}),
    ...(protection && article.protectionLevel === "ALL" ? { protectionLevel: protection } : {}),
  };
  if (Object.keys(data).length > 0) {
    await client.wikiArticle.update({ where: { id: article.id }, data });
  }
  return article.id;
}

/** Apply a plan: the article first (its id is needed), then the revision rows. Returns the id. */
async function writeImport(
  client: ImportClient,
  input: ImportPageInput,
  article: ExistingArticle | null,
  plan: RevisionPlan,
  head: ImportedHead | null,
  hashed: Map<string, string>
): Promise<string> {
  const articleId = await writeArticle(client, input, article, head);
  await insertRevisions(client, articleId, input.source, plan.inserts);
  for (const [rowId, sha1] of hashed) {
    await client.wikiRevision.update({ where: { id: rowId }, data: { sha1 } });
  }
  for (const { rowId, revision } of plan.fills) {
    await client.wikiRevision.update({
      where: { id: rowId },
      data: { wikitext: revision.wikitext ?? "", sha1: revision.sha1, byteSize: revision.byteSize },
    });
  }
  for (const { rowId, mwRevId } of plan.stamps) {
    await client.wikiRevision.update({ where: { id: rowId }, data: { mwRevId } });
  }
  return articleId;
}

/** Read, plan and (unless a dry run) write one page's import; `articleId` is null for a dry run of a new page. */
async function importInto(
  client: ImportClient,
  input: ImportPageInput
): Promise<{ result: ImportPageResult; articleId: string | null; head: ImportedHead | null }> {
  const article = await client.wikiArticle.findUnique({
    where: { source_title: { source: input.source, title: input.title } },
    select: { id: true, mwPageId: true, protectionLevel: true },
  });
  const { rows: existing, hashed } = await loadExistingRows(client, input, article?.id ?? null);
  const plan = planRevisionImport(article?.id ?? null, existing, input.revisions);

  // The dump's head replaces the page's head only when it is newer than every revision stored.
  const previousHeadAt = existing
    .filter((row) => row.articleId === article?.id)
    .reduce<Date | null>(
      (latest, row) => (!latest || row.createdAt > latest ? row.createdAt : latest),
      null
    );
  const head =
    input.head && (!previousHeadAt || input.head.createdAt > previousHeadAt) ? input.head : null;

  const articleId = input.dryRun
    ? (article?.id ?? null)
    : await writeImport(client, input, article, plan, head, hashed);
  return {
    articleId,
    head,
    result: {
      created: article === null,
      inserted: plan.inserts.length,
      filled: plan.fills.length,
      skipped: plan.skipped,
      conflicts: plan.conflicts,
      headUpdated: head !== null,
    },
  };
}

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
    const excerpt =
      input.excerpt?.slice(0, MAX_EXCERPT_LENGTH) ??
      (cleanWikitextExcerpt(wikitext.slice(0, EXCERPT_SOURCE_LENGTH), 300).slice(
        0,
        MAX_EXCERPT_LENGTH
      ) ||
        null);
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
          sha1: mwSha1Base36(wikitext),
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
   * Import one page's revisions from an XML dump, atomically (one transaction per page).
   *
   * Creates the page if it is new, adds the revisions it does not hold (authored as the dump says,
   * never as the importer), fills empty placeholder revisions with their text, and, when the dump's
   * head revision is newer than every revision stored, makes it the page's head (wikitext,
   * redirect, render state). An older dump never replaces a newer head, and importing the same
   * dump twice changes nothing. With `dryRun` it reads and plans but writes nothing.
   */
  static async importPageRevisions(input: ImportPageInput): Promise<ImportPageResult> {
    const { result, articleId, head } = input.dryRun
      ? await importInto(db, input)
      : await db.$transaction((tx) => importInto(tx, input), IMPORT_TRANSACTION);

    // Link graph outside the transaction, best effort, exactly as saveArticle does it.
    if (!input.dryRun && head && articleId) {
      try {
        await LinkGraphService.syncArticleLinks(articleId, head.wikitext, "", input.source);
      } catch (linkErr) {
        console.warn("[ArticleRepository] Best-effort link graph sync failed:", linkErr);
      }
    }
    return result;
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
