/**
 * importer.ts — import a MediaWiki XML dump (events from `readExport`) into WikiOS.
 *
 * One page at a time: the title must be a canonical MediaWiki title in the namespace the dump says,
 * the revisions keep their MediaWiki ids, timestamps, authors and summaries (nothing is authored by
 * the importer), and a page's head only moves forward. Importing a dump twice is a no-op; a dump of
 * the full history fills the empty placeholder revisions `sync-ixwiki-full.ts` left behind. All
 * database work for a page is one transaction inside `ArticleRepository.importPageRevisions`.
 *
 * A page that fails (invalid title, bad timestamp, a database error) is reported in `errors` and
 * the import goes on with the next one; a dump that turns out to be malformed stops the import
 * there, and what was imported before stays.
 */

import { db } from "~/server/db";
import {
  ArticleRepository,
  type ImportedHead,
  type ImportPageInput,
} from "../core/article-repository";
import { canonicalizeTitle, storedNamespace } from "../core/title";
import { cleanExcerpt } from "../transformers/wikitext-parser";
import type { ImportEvent, ImportPage } from "./import-reader";
import type { ImportedRevision } from "./revision-plan";
import { mwSha1Base36 } from "./sha1";
import type { Contributor, XmlRevision } from "./types";

export interface ImportSummary {
  pages: number;
  pagesCreated: number;
  revisionsImported: number;
  /** Revisions the page already had, and rev ids that belong to another page. */
  revisionsSkipped: number;
  /** Empty placeholder revisions that received their text. */
  placeholdersFilled: number;
  /** `<upload>` blocks skipped: files are imported elsewhere. */
  uploadsSkipped: number;
  errors: Array<{ title: string; message: string }>;
}

export interface ImportOptions {
  /** The wiki the dump belongs to (default "ixwiki"). */
  source?: string;
  /** Read and report what would happen; write nothing. */
  dryRun?: boolean;
  /** Called after every page with the running (live, mutable) summary. */
  onProgress?: (summary: ImportSummary) => void;
}

/** Title used for errors that are about the dump rather than one of its pages. */
export const DUMP_ERROR_TITLE = "(dump)";
const DELETED_AUTHOR = "(deleted)";
const SUMMARY_COLUMN_LIMIT = 480;

interface ImportContext {
  source: string;
  dryRun: boolean;
  /** MediaWiki username to WikiOS user id (null: no verified link); one lookup per name per import. */
  authors: Map<string, string | null>;
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";

function emptySummary(): ImportSummary {
  return {
    pages: 0,
    pagesCreated: 0,
    revisionsImported: 0,
    revisionsSkipped: 0,
    placeholdersFilled: 0,
    uploadsSkipped: 0,
    errors: [],
  };
}

/** `edit=sysop:move=sysop` (old dumps) to the protection level WikiOS stores; other rules are ignored. */
function protectionFromRestrictions(
  restrictions: string | null
): ImportPageInput["protectionLevel"] {
  const edit = restrictions
    ?.split(":")
    .map((rule) => rule.split("="))
    .find(([type]) => type === "edit")?.[1];
  if (edit === "sysop") return "SYSOP";
  return edit === "autoconfirmed" ? "AUTOCONFIRMED" : null;
}

/**
 * The page's canonical title and stored namespace. `<ns>` is trusted, and must agree with the
 * title's own prefix.
 */
function resolveIdentity(page: ImportPage, source: string) {
  const canon = page.title.includes("#") ? null : canonicalizeTitle(page.title, { source });
  if (!canon) throw new Error(`Invalid title ${JSON.stringify(page.title)}`);

  const namespace = storedNamespace(canon, page.ns ?? canon.namespaceId);
  if (namespace.namespaceId !== (page.ns ?? canon.namespaceId)) {
    throw new Error(
      `Namespace ${page.ns} does not match the title ${JSON.stringify(canon.title)} (namespace ${namespace.namespaceId})`
    );
  }
  return { canon, namespace };
}

/** Fill `authors` with the verified WikiOS account of each username not seen yet. */
async function linkAuthors(page: ImportPage, ctx: ImportContext): Promise<void> {
  const unknown = [
    ...new Set(
      page.revisions.flatMap(({ contributor }) =>
        "username" in contributor && !ctx.authors.has(contributor.username)
          ? [contributor.username]
          : []
      )
    ),
  ];
  if (unknown.length === 0) return;

  const links = await db.wikiAccountLink.findMany({
    where: { source: ctx.source, username: { in: unknown }, verifiedAt: { not: null } },
    select: { username: true, userId: true },
  });
  for (const name of unknown) ctx.authors.set(name, null);
  for (const link of links) ctx.authors.set(link.username, link.userId);
}

function authorOf(
  contributor: Contributor,
  authors: Map<string, string | null>
): { author: string; authorId: string | null } {
  if ("deleted" in contributor) return { author: DELETED_AUTHOR, authorId: null };
  if ("ip" in contributor) return { author: contributor.ip, authorId: null };
  return { author: contributor.username, authorId: authors.get(contributor.username) ?? null };
}

/** Milliseconds since the epoch of a revision's timestamp; throws on anything that is not a date. */
function timestampOf(revision: XmlRevision): number {
  const time = Date.parse(revision.timestamp);
  if (Number.isNaN(time)) {
    throw new Error(
      `Revision ${revision.id ?? "(no id)"} has an invalid timestamp ${JSON.stringify(revision.timestamp)}`
    );
  }
  return time;
}

/** The page's revisions as stored rows, oldest first, sized and hashed. */
function toImportedRevisions(
  page: ImportPage,
  authors: Map<string, string | null>
): ImportedRevision[] {
  const ordered = page.revisions
    .map((revision) => ({ revision, time: timestampOf(revision) }))
    .sort((a, b) => a.time - b.time || (a.revision.id ?? 0) - (b.revision.id ?? 0));

  let previousSize = 0;
  return ordered.map(({ revision, time }) => {
    const text = revision.text;
    const byteSize = text === null ? (revision.bytes ?? 0) : Buffer.byteLength(text, "utf8");
    const imported: ImportedRevision = {
      mwRevId: revision.id,
      createdAt: new Date(time),
      ...authorOf(revision.contributor, authors),
      summary: revision.comment,
      minor: revision.minor,
      byteSize,
      byteDelta: byteSize - previousSize,
      sha1: revision.sha1 ?? (text === null ? null : mwSha1Base36(text)),
      wikitext: text,
    };
    previousSize = byteSize;
    return imported;
  });
}

/** The article fields of the newest revision that has text, or null when none has. */
function headOf(
  page: ImportPage,
  revisions: ImportedRevision[],
  source: string
): ImportedHead | null {
  const newest = revisions.filter((revision) => revision.wikitext !== null).at(-1);
  if (!newest || newest.wikitext === null) return null;

  const words = newest.wikitext.split(/\s+/).filter(Boolean).length;
  const redirect = page.redirectTitle ? canonicalizeTitle(page.redirectTitle, { source }) : null;
  return {
    createdAt: newest.createdAt,
    mwRevId: newest.mwRevId,
    wikitext: newest.wikitext,
    summary: cleanExcerpt(newest.wikitext, 300).substring(0, SUMMARY_COLUMN_LIMIT) || null,
    wordCount: words,
    readingTime: Math.max(1, Math.ceil(words / 200)),
    redirectTargetSlug: redirect?.title ?? null,
    redirectTargetFragment: redirect?.fragment ?? null,
  };
}

async function buildPageInput(page: ImportPage, ctx: ImportContext): Promise<ImportPageInput> {
  const { canon, namespace } = resolveIdentity(page, ctx.source);
  if (page.revisions.length === 0) throw new Error("The page has no revisions");

  await linkAuthors(page, ctx);
  const revisions = toImportedRevisions(page, ctx.authors);
  return {
    source: ctx.source,
    title: canon.title,
    slug: canon.slug,
    namespace: namespace.namespaceId,
    namespacePrefix: namespace.namespacePrefix,
    mwPageId: page.id,
    protectionLevel: protectionFromRestrictions(page.restrictions),
    revisions,
    head: headOf(page, revisions, ctx.source),
    dryRun: ctx.dryRun,
  };
}

/** Import one page and add what happened to `summary`; a failure becomes an `errors` entry. */
async function importOnePage(
  page: ImportPage,
  ctx: ImportContext,
  summary: ImportSummary
): Promise<void> {
  summary.pages += 1;
  summary.uploadsSkipped += page.uploads;
  try {
    const result = await ArticleRepository.importPageRevisions(await buildPageInput(page, ctx));
    if (result.created) summary.pagesCreated += 1;
    summary.revisionsImported += result.inserted;
    summary.revisionsSkipped += result.skipped + result.conflicts;
    summary.placeholdersFilled += result.filled;
    if (result.conflicts > 0) {
      summary.errors.push({
        title: page.title,
        message: `${result.conflicts} revision(s) already belong to another page and were skipped`,
      });
    }
  } catch (error) {
    summary.errors.push({ title: page.title, message: messageOf(error) });
  }
}

/**
 * Import every page of a dump. Never throws: failures are in the returned summary's `errors`
 * (a malformed or truncated dump as one `(dump)` entry).
 */
export async function importExport(
  events: AsyncIterable<ImportEvent>,
  { source = "ixwiki", dryRun = false, onProgress }: ImportOptions = {}
): Promise<ImportSummary> {
  const summary = emptySummary();
  const ctx: ImportContext = { source, dryRun, authors: new Map() };
  try {
    for await (const event of events) {
      if (event.type !== "page") continue;
      await importOnePage(event.page, ctx, summary);
      onProgress?.(summary);
    }
  } catch (error) {
    summary.errors.push({ title: DUMP_ERROR_TITLE, message: messageOf(error) });
  }
  return summary;
}
