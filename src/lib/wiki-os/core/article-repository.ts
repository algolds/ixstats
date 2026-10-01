/**
 * article-repository.ts — WikiOS Authoritative PostgreSQL Article Repository
 *
 * Primary source of truth for WikiOS articles and revisions.
 * Reads the article's rendered view in one sub-3ms query (`findArticleForView`) and writes in sub-10ms;
 * the view itself is built once per revision by services/render-service.ts.
 */

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
import { isTransactionBusy, PageBusyError } from "./page-busy-error";
import { parseRedirect } from "./redirect";
import { fillRevisionParents } from "./revision-parents";
import { canonicalizeTitle } from "./title";
import {
  planRevisionImport,
  type ExistingRevisionRow,
  type ImportedRevision,
  type RevisionPlan,
} from "../xml/revision-plan";
import { stripXmlForbiddenControlChars } from "../xml/control-chars";
import { mwSha1Base36 } from "../xml/sha1";
import { cleanWikitextExcerpt } from "../transformers/wikitext-parser";
import { enqueueRevisionJob, scheduleMirrorKick } from "../services/mirror-outbox";
import { enqueueRender, invalidateDependents } from "../services/render-service";
import { notifyWatchers } from "../services/watchlist-notify";

/**
 * The first int of the per-title save locks, in the two-int form `pg_advisory_xact_lock(namespace, key)` (a key space of
 * its own: the single-int locks are `withJobLock`'s, staged-uploads.ts uses 41101, cards 7331). Arbitrary.
 */
const ARTICLE_SAVE_LOCK_NAMESPACE = 41102;

/**
 * The save's transaction: it may wait for the page's lock behind another save (or a long import of the page), so it
 * gets more than Prisma's 5 s, like the staged-file and render-metadata transactions.
 */
export const SAVE_TRANSACTION = { maxWait: 10_000, timeout: 30_000 };
/**
 * How long a save waits for the page's lock before it gives up as busy (PostgreSQL's `lock_timeout`, set for the
 * transaction only). Prisma's transaction timeout alone does not bound the wait: it cannot cancel a statement that is
 * blocked on a lock, so the connection would stay occupied until the holder (a long import of the page) finished.
 */
const SAVE_LOCK_TIMEOUT = "10s";

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
    select: { createdAt: true },
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
  /** The lead image the head's wikitext names; left as it is when omitted (a dump import does not derive one). */
  leadImageUrl?: string | null;
}

export interface ImportedRestriction {
  action: "edit" | "move" | "upload";
  level: "sysop" | "autoconfirmed";
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
  /** The same rules as `wiki_restrictions` rows (the table that is enforced); an existing row is never changed. */
  restrictions: ImportedRestriction[];
  /** The dump's revisions, oldest first. */
  revisions: ImportedRevision[];
  /** The newest dump revision that has text, or null when none does. */
  head: ImportedHead | null;
  /**
   * The reference (`toRevisionRef`) of the head the page had before this import, when the caller knows
   * it: the watchers' notification then links the diff, not just the page.
   */
  previousRef?: string | null;
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
/** A stored revision as the plan sees it, with whether it is a parked one (never part of the page's head). */
type StoredRevisionRow = ExistingRevisionRow & { parked?: boolean };
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
): Promise<{ rows: StoredRevisionRow[]; hashed: Map<string, string> }> {
  const select = {
    id: true,
    articleId: true,
    mwRevId: true,
    sha1: true,
    createdAt: true,
    parked: true,
  } as const;
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
    // A changed head marks the rendered view stale (`htmlSyncedAt: null`); the previous HTML and
    // bundle keep being served until the render `importPageRevisions` queues replaces them.
    htmlSyncedAt: null,
    summary: head.summary,
    wordCount: head.wordCount,
    readingTime: head.readingTime,
    mwLatestRevId: head.mwRevId,
    redirectTargetSlug: head.redirectTargetSlug,
    redirectTargetFragment: head.redirectTargetFragment,
    namespace: input.namespace,
    namespacePrefix: input.namespacePrefix,
    ...(head.leadImageUrl === undefined ? {} : { leadImageUrl: head.leadImageUrl }),
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
  for (const { action, level } of input.restrictions) {
    await client.wikiRestriction.upsert({
      where: { source_title_action: { source: input.source, title: input.title, action } },
      create: {
        source: input.source,
        title: input.title,
        action,
        level,
        reason: "Imported from a MediaWiki dump",
      },
      update: {},
    });
  }
  await insertRevisions(client, articleId, input.source, plan.inserts);
  // Each new live revision records the one before it (the dump gives no parents; the order is the history's own).
  if (plan.inserts.length > 0) await fillRevisionParents(client, articleId);
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

  // The dump's head replaces the page's head only when it is newer than every revision stored
  // (a parked revision is not the head, so it does not count).
  const previousHeadAt = existing
    .filter((row) => row.articleId === article?.id && row.parked !== true)
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

export interface FindArticleOptions {
  /** Return a deleted (archived) page too. Default false: to a reader it does not exist. */
  includeArchived?: boolean;
}

type SaveTransaction = Prisma.TransactionClient;

/**
 * Serialize the saves of one page: take the article row's lock (`SELECT ... FOR NO KEY UPDATE`, held until the
 * transaction ends), so a second save of the page waits here until the first has committed and then reads the head it
 * left. The lock is the row's own, so a writer that updates the row (a page move, the inbound sync, an import) queues
 * behind a save too. NO KEY UPDATE, not UPDATE: it conflicts with every other writer of the row but not with the
 * FOR KEY SHARE lock that the foreign-key check of an insert referencing the row takes (the render's link, category
 * and image rows), so a render storing its metadata is never blocked behind a save, nor a save behind it. A page with no row yet cannot be locked: creators of one title queue on an advisory lock instead, and the
 * one that gets it second reads the page the first created.
 */
async function lockPageForSave(tx: SaveTransaction, source: string, title: string): Promise<void> {
  // for this transaction only (`is_local`); the statement that waits too long fails with 55P03, which reads as busy
  await tx.$executeRaw`SELECT set_config('lock_timeout', ${SAVE_LOCK_TIMEOUT}, true)`;
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM wiki_articles WHERE "source" = ${source} AND "title" = ${title} FOR NO KEY UPDATE`;
  if (locked.length > 0) return;
  // $executeRaw, not $queryRaw: the function returns `void`, which Prisma cannot read back as a row
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ARTICLE_SAVE_LOCK_NAMESPACE}::int, hashtext(${`${source}:${title}`}))`;
}

/** The page's latest live revision (a parked one is not the page), as a save under the page's lock reads it. */
function loadHeadForSave(tx: SaveTransaction, source: string, title: string) {
  return tx.wikiRevision.findFirst({
    where: { article: { source, title }, parked: false },
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
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      htmlSyncedAt: row.htmlSyncedAt,
      lastModified: row.revisions[0]?.createdAt ?? null,
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
    const result = await db.$transaction(async (tx) => {
      // 0. Queue behind any other save of this page, then read the head it left: the edit-conflict check, the byte
      // delta and the new revision's parent all come from this one read.
      await lockPageForSave(tx, source, title);
      const previous = await loadHeadForSave(tx, source, title);
      if (input.expectedHeadRef !== undefined && !headMatchesBase(previous, input.expectedHeadRef)) {
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
    }, SAVE_TRANSACTION).catch(retryableWhenBusy);
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

    if (!input.dryRun && head && articleId) {
      // The new head is stale until rendered: render it off the read path, as a backlog (an editor's
      // save renders before it). The render also fills the link graph, the template and image links
      // and the categories; pages that transclude this one are stale now too.
      enqueueRender(articleId, { background: true });
      void invalidateDependents(input.title, input.source);
      // watchlist: a head that moved on an existing page is a change its watchers hear of (once each
      // until they visit); a page the import just created has none yet. The author is left out.
      const headRevision = input.revisions.filter((revision) => revision.wikitext !== null).at(-1);
      if (!result.created && headRevision) {
        void notifyWatchers({
          kind: "edited",
          articleId,
          title: input.title,
          editor: headRevision.author,
          editorUserId: headRevision.authorId,
          summary: headRevision.summary,
          ...(input.previousRef ? { previousRef: input.previousRef } : {}),
          currentRef: head.mwRevId === null ? null : String(head.mwRevId),
        });
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
