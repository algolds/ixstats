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
import { parseRedirect } from "../core/redirect";
import { canonicalizeTitle, storedNamespace } from "../core/title";
import type { EditPolicyResult } from "../namespace-policy";
import { cleanExcerpt } from "../transformers/wikitext-parser";
import type { ImportEvent, ImportPage } from "./import-reader";
import { checkInt4, modelWarning, PageRejected, parseMwTimestamp } from "./import-validation";
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
  /** Things that do not stop a page from importing but are worth a look (hash or model mismatches). */
  warnings: Array<{ title: string; message: string }>;
}

export interface ImportOptions {
  /** The wiki the dump belongs to (default "ixwiki"). */
  source?: string;
  /** Read and report what would happen; write nothing. */
  dryRun?: boolean;
  /** Called after every page with the running (live, mutable) summary. */
  onProgress?: (summary: ImportSummary) => void;
  /**
   * May the importer write the page with this canonical title and stored namespace id? A page it
   * refuses is skipped and listed in `errors` as `permission: <reason>`. Omitted (the operator's
   * command line tools), every page is written.
   */
  canWritePage?: (title: string, namespaceId: number) => EditPolicyResult;
}

/** Title used for errors that are about the dump rather than one of its pages. */
export const DUMP_ERROR_TITLE = "(dump)";
/** Pages in a row that fail to write before the import gives up (database down, schema not migrated). */
export const MAX_CONSECUTIVE_WRITE_FAILURES = 10;
const DELETED_AUTHOR = "(deleted)";
const SUMMARY_COLUMN_LIMIT = 480;

interface ImportContext {
  source: string;
  dryRun: boolean;
  canWritePage: ImportOptions["canWritePage"];
  /** MediaWiki username to WikiOS user id (null: no verified link); one lookup per name per import. */
  authors: Map<string, string | null>;
}

/** Prisma opens its messages with "Invalid `client.model.op()` invocation in <file>" and a source frame. */
const PRISMA_INVOCATION = /^\s*Invalid `[^`]+` invocation/;

/**
 * An error as one readable line. What went wrong in a Prisma message is its last line (the
 * database reports it after the failing call and its source frame).
 */
function messageOf(error: unknown): string {
  if (!(error instanceof Error)) return "Unknown error";
  if (!PRISMA_INVOCATION.test(error.message)) return error.message;
  const lines = error.message.split("\n").filter((line) => line.trim() !== "");
  return lines.at(-1)?.trim() ?? error.message;
}

function emptySummary(): ImportSummary {
  return {
    pages: 0,
    pagesCreated: 0,
    revisionsImported: 0,
    revisionsSkipped: 0,
    placeholdersFilled: 0,
    uploadsSkipped: 0,
    errors: [],
    warnings: [],
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
  checkInt4("page id", page.id);
  checkInt4("namespace", page.ns);
  const canon = page.title.includes("#") ? null : canonicalizeTitle(page.title, { source });
  if (!canon) throw new PageRejected(`Invalid title ${JSON.stringify(page.title)}`);

  const namespace = storedNamespace(canon, page.ns ?? canon.namespaceId);
  if (namespace.namespaceId !== (page.ns ?? canon.namespaceId)) {
    throw new PageRejected(
      `Namespace ${page.ns} does not match the title ${JSON.stringify(canon.title)} (namespace ${namespace.namespaceId})`
    );
  }
  return { canon, namespace };
}

/** Fill `authors` with the verified WikiOS account of each username not seen yet. */
async function linkAuthors(page: ImportPage, ctx: ImportContext): Promise<void> {
  const unseen = [
    ...new Set(
      page.revisions.flatMap(({ contributor }) =>
        "username" in contributor && !ctx.authors.has(contributor.username)
          ? [contributor.username]
          : []
      )
    ),
  ];
  if (unseen.length === 0) return;

  const links = await db.wikiAccountLink.findMany({
    where: { source: ctx.source, username: { in: unseen }, verifiedAt: { not: null } },
    select: { username: true, userId: true },
    take: unseen.length,
  });
  for (const name of unseen) ctx.authors.set(name, null);
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

/** Milliseconds since the epoch of a revision's timestamp; throws on anything but a dump timestamp. */
function timestampOf(revision: XmlRevision): number {
  const time = parseMwTimestamp(revision.timestamp);
  if (time === null) {
    throw new PageRejected(
      `Revision ${revision.id ?? "(no id)"} has an invalid timestamp ${JSON.stringify(revision.timestamp)} ` +
        "(expected YYYY-MM-DDTHH:MM:SSZ)"
    );
  }
  return time;
}

/** Throws unless the revision's id and declared size fit their columns. */
function checkRevisionNumbers(revision: XmlRevision): void {
  checkInt4("revision id", revision.id);
  checkInt4(`size of revision ${revision.id ?? "(no id)"}`, revision.bytes ?? null);
}

/**
 * The page's revisions as stored rows, oldest first, sized and hashed. The hash is always computed
 * from the text; `hashMismatches` counts the revisions whose dump hash says otherwise.
 */
function toImportedRevisions(
  page: ImportPage,
  authors: Map<string, string | null>
): { revisions: ImportedRevision[]; hashMismatches: number } {
  for (const revision of page.revisions) checkRevisionNumbers(revision);
  const ordered = page.revisions
    .map((revision) => ({ revision, time: timestampOf(revision) }))
    .sort((a, b) => a.time - b.time || (a.revision.id ?? 0) - (b.revision.id ?? 0));

  let previousSize = 0;
  let hashMismatches = 0;
  const revisions = ordered.map(({ revision, time }) => {
    const text = revision.text;
    const byteSize = text === null ? (revision.bytes ?? 0) : Buffer.byteLength(text, "utf8");
    const computed = text === null ? null : mwSha1Base36(text);
    if (computed !== null && revision.sha1 !== null && revision.sha1 !== computed) {
      hashMismatches += 1;
    }
    const imported: ImportedRevision = {
      mwRevId: revision.id,
      createdAt: new Date(time),
      ...authorOf(revision.contributor, authors),
      summary: revision.comment,
      commentDeleted: revision.commentDeleted,
      textDeleted: revision.textDeleted,
      userDeleted: "deleted" in revision.contributor,
      minor: revision.minor,
      byteSize,
      byteDelta: byteSize - previousSize,
      sha1: computed ?? revision.sha1 ?? null,
      wikitext: text,
    };
    previousSize = byteSize;
    return imported;
  });
  return { revisions, hashMismatches };
}

/**
 * Where the head revision redirects: its own wikitext decides (MediaWiki's rule, with the section),
 * and the dump's `<redirect title>` is the fallback for text the rule does not recognise.
 */
function redirectOf(
  page: ImportPage,
  wikitext: string,
  source: string
): { title: string; fragment: string | null } | null {
  const fromText = parseRedirect(wikitext);
  if (fromText) return fromText;
  const fromTag = page.redirectTitle ? canonicalizeTitle(page.redirectTitle, { source }) : null;
  return fromTag ? { title: fromTag.title, fragment: fromTag.fragment } : null;
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
  const redirect = redirectOf(page, newest.wikitext, source);
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

/** The store-ready page, and what about it is worth a warning. */
async function buildPageInput(
  page: ImportPage,
  ctx: ImportContext
): Promise<{ input: ImportPageInput; warnings: string[] }> {
  const { canon, namespace } = resolveIdentity(page, ctx.source);
  const verdict = ctx.canWritePage?.(canon.title, namespace.namespaceId);
  if (verdict && !verdict.allowed) throw new PageRejected(`permission: ${verdict.reason}`);
  if (page.revisions.length === 0) throw new PageRejected("The page has no revisions");

  await linkAuthors(page, ctx);
  const { revisions, hashMismatches } = toImportedRevisions(page, ctx.authors);
  const warnings = [
    modelWarning(canon.title, page.revisions),
    hashMismatches > 0
      ? `${hashMismatches} revision(s) have a sha1 that does not match their text (the recomputed hash is stored)`
      : null,
  ].filter((warning): warning is string => warning !== null);

  const input: ImportPageInput = {
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
  return { input, warnings };
}

/** How one page went: imported, rejected as malformed, or failed in the database. */
type PageOutcome = "imported" | "rejected" | "failed";

/** Import one page and add what happened to `summary`; a failure becomes an `errors` entry. */
async function importOnePage(
  page: ImportPage,
  ctx: ImportContext,
  summary: ImportSummary
): Promise<PageOutcome> {
  summary.pages += 1;
  summary.uploadsSkipped += page.uploads;
  try {
    const { input, warnings } = await buildPageInput(page, ctx);
    const result = await ArticleRepository.importPageRevisions(input);
    for (const message of warnings) summary.warnings.push({ title: page.title, message });
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
    return "imported";
  } catch (error) {
    summary.errors.push({ title: page.title, message: messageOf(error) });
    return error instanceof PageRejected ? "rejected" : "failed";
  }
}

/**
 * Import every page of a dump. Never throws: failures are in the returned summary's `errors`
 * (a malformed or truncated dump as one `(dump)` entry). When `MAX_CONSECUTIVE_WRITE_FAILURES`
 * pages in a row fail in the database, the import stops instead of failing every page of the dump.
 */
export async function importExport(
  events: AsyncIterable<ImportEvent>,
  { source = "ixwiki", dryRun = false, onProgress, canWritePage }: ImportOptions = {}
): Promise<ImportSummary> {
  const summary = emptySummary();
  const ctx: ImportContext = { source, dryRun, canWritePage, authors: new Map() };
  let failuresInARow = 0;
  try {
    for await (const event of events) {
      if (event.type !== "page") continue;
      const outcome = await importOnePage(event.page, ctx, summary);
      onProgress?.(summary);

      if (outcome === "imported") failuresInARow = 0;
      if (outcome === "failed") failuresInARow += 1;
      if (failuresInARow >= MAX_CONSECUTIVE_WRITE_FAILURES) {
        summary.errors.push({
          title: DUMP_ERROR_TITLE,
          message:
            `Stopped after ${failuresInARow} pages in a row failed to import ` +
            `(last: ${summary.errors[summary.errors.length - 1]?.message}). ` +
            "Is the database reachable and migrated (prisma/manual-migrations)?",
        });
        break;
      }
    }
  } catch (error) {
    summary.errors.push({ title: DUMP_ERROR_TITLE, message: messageOf(error) });
  }
  return summary;
}
