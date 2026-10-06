// Importing a page's revisions from an XML dump (split out of article-repository.ts; ArticleRepository exposes it
// as `importPageRevisions`).

import type { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { lockPageForSave } from "./page-lock";
import { fillRevisionParents } from "./revision-parents";
import {
  planRevisionImport,
  type ExistingRevisionRow,
  type ImportedRevision,
  type RevisionPlan,
} from "../xml/revision-plan";
import { mwSha1Base36 } from "../xml/sha1";
import { enqueueRender, invalidateDependents } from "../services/render-service";
import { notifyWatchers } from "../services/watchlist-notify";

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
  // A real import queues behind any save of the page (and holds the page against the next one), and reads the page
  // only once it has the lock: a save that committed meanwhile is then part of what the dump's head is compared with,
  // so an older head can never overwrite it. A dry run writes nothing and takes no lock.
  if (!input.dryRun) await lockPageForSave(client, input.source, input.title);
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

/**
 * Import one page's revisions from an XML dump, atomically (one transaction per page).
 *
 * Creates the page if it is new, adds the revisions it does not hold (authored as the dump says,
 * never as the importer), fills empty placeholder revisions with their text, and, when the dump's
 * head revision is newer than every revision stored, makes it the page's head (wikitext,
 * redirect, render state). An older dump never replaces a newer head, and importing the same
 * dump twice changes nothing. With `dryRun` it reads and plans but writes nothing.
 */
export async function importPageRevisions(input: ImportPageInput): Promise<ImportPageResult> {
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
