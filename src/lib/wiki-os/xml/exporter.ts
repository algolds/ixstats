/**
 * exporter.ts — write WikiOS pages as a MediaWiki XML dump (export-0.11).
 *
 * Shared by the export route (a list of titles) and `scripts/wikios-export-xml.ts` (every page).
 * Only PUBLISHED pages are exported. Pages are read in batches by id cursor and revisions in
 * batches by (time, id) cursor, so a whole wiki streams through `write` without being held in
 * memory. Current-only export writes each page's head (its wikitext with the newest revision's
 * author, time and summary); full history writes every stored revision, and a placeholder
 * revision (empty text with a recorded size: history `sync-ixwiki-full.ts` never fetched) is
 * written as a revision whose text is not available, exactly as a dump marks deleted text.
 */

import { isIP } from "node:net";
import { db } from "~/server/db";
import { parseRedirect } from "../core/redirect";
import { canonicalizeTitle } from "../core/title";
import { contentModelFor, type ContentModel } from "./content-model";
import {
  createExportWriter,
  toXmlTimestamp,
  type ExportSink,
  type ExportPage,
} from "./export-writer";
import type { Contributor, XmlRevision } from "./types";

export interface ExportSelection {
  source: string;
  /** Export exactly these titles (non-canonical spellings are canonicalized, unknown ones skipped). */
  titles?: string[];
  /** Restrict to these namespace ids (ignored when `titles` is given). */
  namespaces?: number[];
  /** Every stored revision instead of the current one. */
  history: boolean;
}

const PAGE_BATCH = 200;
const REVISION_BATCH = 200;
const DELETED_AUTHOR = "(deleted)";

interface PageRow {
  id: string;
  title: string;
  namespace: number;
  mwPageId: number | null;
  wikitext: string;
  redirectTargetSlug: string | null;
  redirectTargetFragment: string | null;
  updatedAt: Date;
}

interface RevisionRow {
  id: string;
  mwRevId: number | null;
  author: string | null;
  summary: string | null;
  minor: boolean;
  byteSize: number;
  /** Only read for full history. */
  sha1?: string | null;
  textDeleted: boolean;
  commentDeleted: boolean;
  userDeleted: boolean;
  createdAt: Date;
  wikitext: string;
}

const PAGE_SELECT = {
  id: true,
  title: true,
  namespace: true,
  mwPageId: true,
  wikitext: true,
  redirectTargetSlug: true,
  redirectTargetFragment: true,
  updatedAt: true,
} as const;

/** The revision columns a current-only export needs (no hash: the writer hashes the text it writes). */
const CURRENT_REVISION_SELECT = {
  id: true,
  mwRevId: true,
  author: true,
  summary: true,
  minor: true,
  byteSize: true,
  textDeleted: true,
  commentDeleted: true,
  userDeleted: true,
  createdAt: true,
  wikitext: true,
} as const;

/** Full history also reads `sha1`, which a placeholder revision (no text to hash) is exported with. */
const HISTORY_REVISION_SELECT = { ...CURRENT_REVISION_SELECT, sha1: true } as const;

/** Who a revision's `author` string names: an IP, a hidden contributor, or an account. */
export function contributorOf(author: string | null): Contributor {
  if (author === null || author === DELETED_AUTHOR) return { deleted: true };
  return isIP(author) === 0 ? { username: author, id: null } : { ip: author };
}

/**
 * A stored revision as a dump revision. Text an administrator deleted is written as deleted; a
 * placeholder (empty text, but a recorded size: history that was never fetched) as text that is
 * not available, carrying its size. Both keep the size and hash they had.
 */
function toXmlRevision(
  row: RevisionRow,
  parentId: number | null,
  { model, format }: ContentModel
): XmlRevision {
  const unavailable = row.textDeleted || (row.wikitext === "" && row.byteSize > 0);
  return {
    id: row.mwRevId,
    parentId,
    timestamp: toXmlTimestamp(row.createdAt),
    contributor: row.userDeleted ? { deleted: true } : contributorOf(row.author),
    minor: row.minor,
    comment: row.commentDeleted ? null : row.summary,
    commentDeleted: row.commentDeleted,
    model,
    format,
    text: unavailable ? null : row.wikitext,
    textDeleted: row.textDeleted,
    ...(unavailable ? { bytes: row.byteSize, sha1: row.sha1 ?? null } : {}),
  };
}

/**
 * Every stored revision of a page, oldest first, in batches. A page with no revision rows at all
 * (written before revisions were kept) still has its head: it is exported as one revision, the
 * same as a current-only export would.
 */
async function* historyOf(page: PageRow): AsyncGenerator<XmlRevision> {
  const contentModel = contentModelFor(page.title);
  let cursor: string | undefined;
  let parentId: number | null = null;
  let exported = false;
  for (;;) {
    const batch: RevisionRow[] = await db.wikiRevision.findMany({
      // A parked revision never went live: a dump of the page's history leaves it out (re-imported, it
      // would be taken for the page's newest revision).
      where: { articleId: page.id, parked: false },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: REVISION_BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: HISTORY_REVISION_SELECT,
    });
    for (const row of batch) {
      yield toXmlRevision(row, parentId, contentModel);
      parentId = row.mwRevId;
      exported = true;
    }
    if (batch.length < REVISION_BATCH) break;
    cursor = batch[batch.length - 1]?.id;
  }
  if (!exported) yield currentRevision(page, undefined);
}

/**
 * The newest revision of a page that has its text: the one the page's head came from. (A newer
 * placeholder, history that was never fetched, or a revision whose text was deleted, is not the head.)
 */
async function newestRevision(articleId: string): Promise<RevisionRow | undefined> {
  const row: RevisionRow | null = await db.wikiRevision.findFirst({
    where: {
      articleId,
      parked: false,
      textDeleted: false,
      OR: [{ wikitext: { not: "" } }, { byteSize: 0 }],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: CURRENT_REVISION_SELECT,
  });
  return row ?? undefined;
}

/** The page's head as one revision: its wikitext with the newest revision's attribution. */
function currentRevision(page: PageRow, newest: RevisionRow | undefined): XmlRevision {
  const contentModel = contentModelFor(page.title);
  if (!newest) {
    return {
      id: null,
      parentId: null,
      timestamp: toXmlTimestamp(page.updatedAt),
      contributor: { deleted: true },
      minor: false,
      comment: null,
      commentDeleted: false,
      ...contentModel,
      text: page.wikitext,
      textDeleted: false,
    };
  }
  return { ...toXmlRevision(newest, null, contentModel), text: page.wikitext, textDeleted: false };
}

/**
 * The page's redirect target for `<redirect title>`, fragment included ("Target#Section"). For
 * IxWiki the wikitext decides (the columns are a cache that can be stale); another wiki's pages
 * use the columns, since WikiOS only knows IxWiki's namespaces.
 */
function redirectTitleOf(page: PageRow, source: string): string | null {
  const target =
    source === "ixwiki" ? parseRedirect(page.wikitext) : redirectFromColumns(page, source);
  if (!target) return null;
  return target.fragment ? `${target.title}#${target.fragment}` : target.title;
}

function redirectFromColumns(
  page: PageRow,
  source: string
): { title: string; fragment: string | null } | null {
  const canon = page.redirectTargetSlug
    ? canonicalizeTitle(page.redirectTargetSlug, { source })
    : null;
  return canon ? { title: canon.title, fragment: page.redirectTargetFragment } : null;
}

/** Published pages matching `selection`, in batches (ordered by title for a title list). */
async function* publishedPages(selection: ExportSelection): AsyncGenerator<PageRow[]> {
  const canonicalTitles = (selection.titles ?? []).flatMap((raw) => {
    const canon = canonicalizeTitle(raw, { source: selection.source });
    return canon ? [canon.title] : [];
  });
  const where = {
    source: selection.source,
    status: "PUBLISHED",
    ...(selection.titles
      ? { title: { in: [...new Set(canonicalTitles)] } }
      : selection.namespaces
        ? { namespace: { in: selection.namespaces } }
        : {}),
  };

  let cursor: string | undefined;
  for (;;) {
    const batch: PageRow[] = await db.wikiArticle.findMany({
      where,
      orderBy: { id: "asc" },
      take: PAGE_BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: PAGE_SELECT,
    });
    if (batch.length === 0) return;
    yield batch;
    if (batch.length < PAGE_BATCH) return;
    cursor = batch[batch.length - 1]?.id;
  }
}

/**
 * Write the selected pages as an export-0.11 document through `write`; resolves to the number of
 * pages written. A failure part-way rejects: the document written so far is truncated, not valid.
 */
export async function writeExport(write: ExportSink, selection: ExportSelection): Promise<number> {
  const writer = createExportWriter(write);
  await writer.start();
  let pages = 0;
  for await (const batch of publishedPages(selection)) {
    for (const page of batch) {
      const exportPage: ExportPage = {
        title: page.title,
        ns: page.namespace,
        pageId: page.mwPageId,
        redirectTitle: redirectTitleOf(page, selection.source),
        revisions: selection.history
          ? historyOf(page)
          : [currentRevision(page, await newestRevision(page.id))],
      };
      await writer.page(exportPage);
      pages += 1;
    }
  }
  await writer.end();
  return pages;
}
